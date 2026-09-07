using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DoctorsController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public DoctorsController(UserManager<ApplicationUser> userManager)
        => _userManager = userManager;

    [HttpGet]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var doctors = await _userManager.Users
            .Where(u => u.IsActive && u.Role == UserRole.SuperAdmin)
            .OrderBy(u => u.LastName)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.FullNameEn
            })
            .ToListAsync(ct);

        return Ok(doctors);
    }
}
