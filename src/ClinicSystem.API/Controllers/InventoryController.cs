using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize(Roles = "SuperAdmin,Admin")]
public class InventoryController : ControllerBase
{
    private readonly ClinicDbContext _db;
    public InventoryController(ClinicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? branchId, [FromQuery] bool lowStockOnly, CancellationToken ct)
    {
        var query = _db.InventoryItems.AsNoTracking().AsQueryable();
        if (branchId.HasValue) query = query.Where(x => x.BranchId == branchId);
        if (lowStockOnly) query = query.Where(x => x.QuantityOnHand <= x.ReorderLevel);
        return Ok(await query.OrderBy(x => x.Name).Take(500).Select(x => new
        {
            x.Id, x.BranchId, x.Sku, x.Name, x.Unit, x.QuantityOnHand, x.ReorderLevel,
            x.BatchNumber, x.ExpiryDate, x.IsActive,
            LowStock = x.QuantityOnHand <= x.ReorderLevel
        }).ToListAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateInventoryRequest request, CancellationToken ct)
    {
        var sku = request.Sku?.Trim(); var name = request.Name?.Trim(); var unit = request.Unit?.Trim();
        if (string.IsNullOrWhiteSpace(sku) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(unit))
            return BadRequest(new { message = "SKU, name and unit are required." });
        if (await _db.InventoryItems.AnyAsync(x => x.BranchId == request.BranchId && x.Sku == sku, ct))
            return Conflict(new { message = "SKU already exists in this branch." });
        var item = new InventoryItem
        {
            BranchId = request.BranchId, Sku = sku, Name = name, Unit = unit,
            ReorderLevel = Math.Max(0, request.ReorderLevel), BatchNumber = request.BatchNumber?.Trim(),
            ExpiryDate = request.ExpiryDate
        };
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Sku, item.Name });
    }

    [HttpPost("{id:guid}/adjust")]
    public async Task<IActionResult> Adjust(Guid id, InventoryAdjustmentRequest request, CancellationToken ct)
    {
        if (request.QuantityDelta == 0) return BadRequest(new { message = "Quantity delta cannot be zero." });
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await _db.InventoryItems.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound();
        var next = item.QuantityOnHand + request.QuantityDelta;
        if (next < 0) return Conflict(new { message = "Inventory cannot become negative." });
        item.QuantityOnHand = next;
        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            InventoryItemId = id, Type = request.Type, QuantityDelta = request.QuantityDelta,
            BalanceAfter = next, PerformedByUserId = CurrentUserId(),
            Reference = request.Reference?.Trim(), Notes = request.Notes?.Trim()
        });
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { item.Id, item.QuantityOnHand, LowStock = item.QuantityOnHand <= item.ReorderLevel });
    }

    [HttpGet("{id:guid}/transactions")]
    public async Task<IActionResult> Transactions(Guid id, CancellationToken ct) => Ok(await _db.InventoryTransactions
        .AsNoTracking().Where(x => x.InventoryItemId == id).OrderByDescending(x => x.CreatedAt).Take(200)
        .Select(x => new { x.Id, x.Type, x.QuantityDelta, x.BalanceAfter, x.PerformedByUserId, x.Reference, x.Notes, x.CreatedAt })
        .ToListAsync(ct));

    private Guid CurrentUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}

public sealed record CreateInventoryRequest(Guid? BranchId, string Sku, string Name, string Unit,
    decimal ReorderLevel, string? BatchNumber, DateTime? ExpiryDate);
public sealed record InventoryAdjustmentRequest(InventoryTransactionType Type, decimal QuantityDelta, string? Reference, string? Notes);
