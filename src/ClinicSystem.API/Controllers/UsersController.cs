// ══════════════════════════════════════════════════════════════
// UsersController — کنترلر مدیریت کاربران
//
// این کنترلر برای مدیر سیستم (SuperAdmin = دکتر) هست که
// می‌تونه کاربران رو مدیریت کنه:
// - ایجاد کاربر جدید (دکتر، منشی، بیمار)
// - فعال/غیرفعال کردن حساب کاربری
// - تغییر نقش
// - ریست رمز عبور
//
// دسترسی: فقط SuperAdmin (دکتر اصلی)
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")] // فقط دکتر اصلی (SuperAdmin) می‌تونه بیاد اینجا
public class UsersController : ControllerBase
{
    // UserManager: ابزار ASP.NET Identity برای مدیریت کاربران
    // (ایجاد، ویرایش، تغییر رمز، اضافه به نقش و...)
    private readonly UserManager<ApplicationUser> _userMgr;

    // RoleManager: ابزار مدیریت نقش‌ها (SuperAdmin، Admin، Patient)
    private readonly RoleManager<IdentityRole<Guid>> _roleMgr;

    public UsersController(
        UserManager<ApplicationUser> userMgr,
        RoleManager<IdentityRole<Guid>> roleMgr)
    {
        _userMgr = userMgr;
        _roleMgr = roleMgr;
    }

    // ──────────────────────────────────────────────────────────────
    // GetAll: گرفتن لیست کاربران با جستجو و فیلتر
    // آدرس: GET /api/users
    //
    // پارامترها:
    // search: جستجو بر اساس نام یا شماره موبایل
    // role: فیلتر بر اساس نقش
    // page, pageSize: صفحه‌بندی
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] UserRole? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _userMgr.Users.AsQueryable(); // شروع کوئری روی همه کاربران

        // اگه جستجو داده شده — نام یا شماره موبایل
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(u =>
                u.PhoneNumber!.Contains(s) ||
                (u.FirstName + " " + u.LastName).ToLower().Contains(s));
        }

        // اگه فیلتر نقش داده شده
        if (role.HasValue)
            query = query.Where(u => u.Role == role.Value);

        var total = await query.CountAsync(ct); // تعداد کل (قبل از صفحه‌بندی)

        // صفحه‌بندی — جدیدترین کاربر اول
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.FullName,       // نام کامل فارسی
                u.FullNameEn,     // نام کامل انگلیسی
                u.PhoneNumber,    // شماره موبایل
                u.Email,
                u.Role,           // SuperAdmin، Admin، Patient
                u.IsActive,       // آیا حساب فعال هست؟
                u.ProfileImageUrl,
                u.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new { items = users, total, page, pageSize });
    }

    // ──────────────────────────────────────────────────────────────
    // Create: ایجاد کاربر جدید
    // آدرس: POST /api/users
    //
    // می‌تونه هر نوع کاربری بسازه (دکتر، منشی، بیمار)
    // چک می‌کنه که شماره موبایل تکراری نباشه
    // ──────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        if (dto.Role == UserRole.Patient)
            return BadRequest(new { message = "بیمار باید از مسیر ثبت‌نام بیمار ایجاد شود." });

        // چک کردن تکراری نبودن شماره موبایل
        var existing = await _userMgr.FindByNameAsync(dto.PhoneNumber);
        if (existing != null)
            return Conflict(new { message = "این شماره موبایل قبلاً ثبت شده است." });

        // ساختن کاربر جدید
        var user = new ApplicationUser
        {
            UserName             = dto.PhoneNumber, // username = شماره موبایل
            PhoneNumber          = dto.PhoneNumber,
            FirstName            = dto.FirstName,
            LastName             = dto.LastName,
            FirstNameEn          = dto.FirstNameEn ?? dto.FirstName,
            LastNameEn           = dto.LastNameEn ?? dto.LastName,
            Role                 = dto.Role,
            IsActive             = true,
            PhoneNumberConfirmed = true, // نیازی به تأیید SMS نیست
        };

        // ذخیره در دیتابیس با هش کردن رمز
        var result = await _userMgr.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        // اضافه کردن به نقش مربوطه (SuperAdmin، Admin، یا Patient)
        var roleResult = await _userMgr.AddToRoleAsync(user, dto.Role.ToString());
        if (!roleResult.Succeeded)
        {
            await _userMgr.DeleteAsync(user);
            return BadRequest(new { errors = roleResult.Errors.Select(e => e.Description) });
        }

        return Ok(new { user.Id, user.FullName, user.PhoneNumber, user.Role });
    }

    // ──────────────────────────────────────────────────────────────
    // ToggleActive: فعال/غیرفعال کردن حساب کاربری
    // آدرس: PATCH /api/users/{id}/toggle-active
    //
    // یه کاربر غیرفعال نمی‌تونه لاگین کنه
    // نمیشه حساب خودت رو غیرفعال کنی (جلوگیری از قطع دسترسی)
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        // جلوگیری از غیرفعال کردن حساب خودت!
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == currentUserId)
            return BadRequest(new { message = "نمی‌توانید حساب خود را غیرفعال کنید." });

        var user = await _userMgr.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();
        // برعکس کن: فعال → غیرفعال، غیرفعال → فعال
        user.IsActive = !user.IsActive;
        var result = await _userMgr.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        return Ok(new { user.Id, user.IsActive }); // وضعیت جدید رو برگردون
    }

    // ──────────────────────────────────────────────────────────────
    // ChangeRole: تغییر نقش یه کاربر
    // آدرس: PATCH /api/users/{id}/role
    //
    // مثلاً: Patient → Admin (منشی جدید)
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/role")]
    public async Task<IActionResult> ChangeRole(Guid id, [FromBody] ChangeRoleDto dto)
    {
        if (dto.Role == UserRole.Patient)
            return BadRequest(new { message = "تغییر نقش به بیمار بدون ساخت پرونده پزشکی مجاز نیست." });

        // نمیشه نقش خودت رو تغییر بدی
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (id == currentUserId)
            return BadRequest(new { message = "نمی‌توانید نقش خود را تغییر دهید." });

        var user = await _userMgr.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();
        var oldRole = user.Role;

        // ابتدا همه نقش‌های فعلی رو حذف کن
        var oldRoles = await _userMgr.GetRolesAsync(user);
        var removeResult = await _userMgr.RemoveFromRolesAsync(user, oldRoles);
        if (!removeResult.Succeeded)
            return BadRequest(new { errors = removeResult.Errors.Select(e => e.Description) });

        // بعد نقش جدید رو اضافه کن
        user.Role = dto.Role;
        var updateResult = await _userMgr.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(new { errors = updateResult.Errors.Select(e => e.Description) });

        var addResult = await _userMgr.AddToRoleAsync(user, dto.Role.ToString());
        if (!addResult.Succeeded)
        {
            user.Role = oldRole;
            await _userMgr.UpdateAsync(user);
            await _userMgr.AddToRolesAsync(user, oldRoles);
            return BadRequest(new { errors = addResult.Errors.Select(e => e.Description) });
        }

        return Ok(new { user.Id, user.Role });
    }

    // ──────────────────────────────────────────────────────────────
    // ResetPassword: ریست رمز عبور یه کاربر
    // آدرس: POST /api/users/{id}/reset-password
    //
    // دکتر می‌تونه برای هر کاربری رمز جدید ست کنه
    // (بدون نیاز به دانستن رمز قدیمی)
    // ──────────────────────────────────────────────────────────────
    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordDto dto)
    {
        var user = await _userMgr.FindByIdAsync(id.ToString());
        if (user == null) return NotFound();

        // تولید توکن یک‌بارمصرف ریست رمز
        var token = await _userMgr.GeneratePasswordResetTokenAsync(user);

        // استفاده از توکن برای تغییر رمز
        var result = await _userMgr.ResetPasswordAsync(user, token, dto.NewPassword);

        return result.Succeeded
            ? NoContent() // ۲۰۴ — موفق
            : BadRequest(new { errors = result.Errors.Select(e => e.Description) });
    }
}

// ── DTOهای ورودی ─────────────────────────────────────────────

// برای ساختن کاربر جدید
public record CreateUserDto(
    string FirstName,    // نام فارسی
    string LastName,     // نام خانوادگی فارسی
    string? FirstNameEn, // نام انگلیسی (اختیاری)
    string? LastNameEn,  // نام خانوادگی انگلیسی (اختیاری)
    string PhoneNumber,  // شماره موبایل (username هم میشه)
    string Password,     // رمز اولیه
    UserRole Role        // SuperAdmin، Admin، یا Patient
);

// برای تغییر نقش
public record ChangeRoleDto(UserRole Role);

// برای ریست رمز
public record ResetPasswordDto(string NewPassword);
