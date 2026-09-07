using ClinicSystem.Domain.Entities;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/branches")]
[Authorize]
public class BranchesController : ControllerBase
{
    private readonly ClinicDbContext _db;
    public BranchesController(ClinicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await _db.ClinicBranches
        .AsNoTracking().OrderBy(x => x.Name)
        .Select(x => new { x.Id, x.Name, x.Address, x.PhoneNumber, x.TimeZoneId, x.IsActive })
        .ToListAsync(ct));

    [HttpPost]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Create(CreateBranchRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Branch name is required." });
        if (await _db.ClinicBranches.AnyAsync(x => x.Name == name, ct))
            return Conflict(new { message = "A branch with this name already exists." });
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId); }
        catch { return BadRequest(new { message = "Invalid time zone." }); }

        var branch = new ClinicBranch
        {
            Name = name, Address = request.Address?.Trim(), PhoneNumber = request.PhoneNumber?.Trim(),
            TimeZoneId = request.TimeZoneId, IsActive = true
        };
        _db.ClinicBranches.Add(branch);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetAll), new { }, new { branch.Id, branch.Name });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Update(Guid id, UpdateBranchRequest request, CancellationToken ct)
    {
        var branch = await _db.ClinicBranches.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (branch == null) return NotFound();
        if (!string.IsNullOrWhiteSpace(request.Name)) branch.Name = request.Name.Trim();
        if (request.Address != null) branch.Address = request.Address.Trim();
        if (request.PhoneNumber != null) branch.PhoneNumber = request.PhoneNumber.Trim();
        if (request.IsActive.HasValue) branch.IsActive = request.IsActive.Value;
        branch.SetUpdated();
        await _db.SaveChangesAsync(ct);
        return Ok(new { branch.Id, branch.Name, branch.IsActive });
    }
}

public sealed record CreateBranchRequest(string Name, string? Address, string? PhoneNumber, string TimeZoneId = "Iran Standard Time");
public sealed record UpdateBranchRequest(string? Name, string? Address, string? PhoneNumber, bool? IsActive);
