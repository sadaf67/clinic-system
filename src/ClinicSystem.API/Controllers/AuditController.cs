using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/audit")]
[Authorize(Roles = "SuperAdmin")]
public class AuditController : ControllerBase
{
    private readonly ClinicDbContext _db;
    public AuditController(ClinicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? entityType, [FromQuery] string? entityId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(x => x.EntityType == entityType);
        if (!string.IsNullOrWhiteSpace(entityId)) query = query.Where(x => x.EntityId == entityId);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.Id, x.ActorUserId, x.ActorName, x.Action, x.EntityType, x.EntityId,
                x.OldValuesJson, x.NewValuesJson, x.IpAddress, x.CorrelationId, x.CreatedAt
            }).ToListAsync(ct);
        return Ok(new { items, total, page, pageSize });
    }
}
