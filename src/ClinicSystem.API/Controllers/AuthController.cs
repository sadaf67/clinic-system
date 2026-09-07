// ══════════════════════════════════════════════════════════════
// AuthController = کنترلر احراز هویت
// این کنترلر همه کارهای مربوط به "هویت" کاربر رو مدیریت می‌کنه:
// - ورود (لاگین)
// - ثبت‌نام
// - خروج
// - تمدید توکن
// - مشاهده/ویرایش پروفایل
// - تغییر رمز عبور
//
// آدرس‌های این کنترلر: /api/auth/...
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.DTOs.Auth;
using ClinicSystem.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

// [ApiController] = این یه کنترلر API هست (نه صفحه وب معمولی)
// [Route("api/[controller]")] = آدرس: /api/auth
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    // سرویس احراز هویت - همه منطق اصلی اونجاست
    private readonly IAuthService _authService;

    // Dependency Injection: سرویس از بیرون تزریق میشه
    public AuthController(IAuthService authService) => _authService = authService;

    // ─── POST /api/auth/login ──────────────────────────────────
    // ورود به سیستم با شماره موبایل و رمز عبور
    // درخواست: { "userName": "09120000000", "password": "Admin@12345" }
    // پاسخ موفق: توکن JWT + اطلاعات کاربر
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _authService.LoginAsync(dto, ct);
            return Ok(result); // HTTP 200 + توکن
        }
        catch (UnauthorizedAccessException ex)
        {
            // شماره یا رمز اشتباه بود: HTTP 401 Unauthorized
            return Unauthorized(new { message = ex.Message });
        }
    }

    // ─── POST /api/auth/register ───────────────────────────────
    // ثبت‌نام بیمار جدید
    // درخواست: اطلاعات شخصی + رمز عبور
    // پاسخ موفق: توکن JWT + اطلاعات کاربر جدید
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterPatientDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _authService.RegisterPatientAsync(dto, ct);
            return Ok(result); // HTTP 200
        }
        catch (InvalidOperationException ex)
        {
            // مثلاً: شماره تکراریه → HTTP 400 Bad Request
            return BadRequest(new { message = ex.Message });
        }
    }

    // ─── POST /api/auth/refresh ────────────────────────────────
    // تمدید توکن بدون لاگین مجدد
    // درخواست: Refresh Token (که موقع لاگین گرفتیم)
    // پاسخ: توکن جدید
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh([FromBody] string refreshToken, CancellationToken ct)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(refreshToken, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            // Refresh Token منقضی شده یا جعلیه → باید دوباره لاگین کنه
            return Unauthorized(new { message = ex.Message });
        }
    }

    // ─── POST /api/auth/logout ─────────────────────────────────
    // خروج از سیستم - Refresh Token رو باطل می‌کنه
    // [Authorize] یعنی فقط کاربران لاگین کرده می‌تونن این رو صدا بزنن
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        // ID کاربر رو از توکن JWT بخون (مثل چک کردن کارت شناسایی)
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _authService.LogoutAsync(userId, ct);
        return NoContent(); // HTTP 204 - موفق، چیزی برای برگشت نداریم
    }

    // ─── GET /api/auth/profile ─────────────────────────────────
    // مشاهده اطلاعات پروفایل کاربر لاگین کرده
    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<UserProfileDto>> GetProfile(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var profile = await _authService.GetProfileAsync(userId, ct);
        return Ok(profile);
    }

    // ─── PUT /api/auth/profile ─────────────────────────────────
    // ویرایش پروفایل (اسم، عکس، تنظیمات اعلان)
    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<UserProfileDto>> UpdateProfile([FromBody] UpdateProfileDto dto, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var profile = await _authService.UpdateProfileAsync(userId, dto, ct);
        return Ok(profile);
    }

    // ─── POST /api/auth/change-password ───────────────────────
    // تغییر رمز عبور (باید رمز قدیمی رو هم بدی)
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _authService.ChangePasswordAsync(userId, dto, ct);
        // اگه موفق بود HTTP 204، اگه نه HTTP 400 (رمز قدیمی اشتباه)
        return result ? NoContent() : BadRequest(new { message = "Invalid current password." });
    }
}
