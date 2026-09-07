// ══════════════════════════════════════════════════════════════
// این کلاس همه کارهای مربوط به احراز هویت رو انجام میده:
// - لاگین (ورود به سیستم)
// - ثبت‌نام بیمار جدید
// - تمدید توکن (وقتی توکن منقضی میشه)
// - خروج از سیستم
// - تغییر رمز عبور
// - نمایش و ویرایش پروفایل
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.DTOs.Auth;
using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.Infrastructure.Identity;

public class AuthService : IAuthService
{
    // UserManager ابزار مایکروسافت برای مدیریت کاربران هست
    // کارهایی مثل: پیدا کردن کاربر، چک کردن رمز عبور، ساختن کاربر جدید
    private readonly UserManager<ApplicationUser> _userMgr;

    // این سرویس توکن JWT می‌سازه (کارت شناسایی دیجیتال)
    private readonly JwtTokenService _jwtService;

    // Dependency Injection: این دو سرویس از بیرون به این کلاس تزریق میشن
    public AuthService(UserManager<ApplicationUser> userMgr, JwtTokenService jwtService)
    {
        _userMgr = userMgr;
        _jwtService = jwtService;
    }

    // ─── ورود به سیستم (لاگین) ────────────────────────────────
    public async Task<AuthResponseDto> LoginAsync(LoginDto dto, CancellationToken ct = default)
    {
        // دنبال کاربری با این شماره تلفن بگرد
        // اگه پیدا نشد، خطا بده (علامت ?? یعنی: اگه null بود، throw کن)
        var user = await _userMgr.FindByNameAsync(dto.UserName)
            ?? throw new UnauthorizedAccessException("نام کاربری یا رمز عبور نادرست است.");

        if (await _userMgr.IsLockedOutAsync(user))
            throw new UnauthorizedAccessException("حساب کاربری موقتاً قفل شده است. کمی بعد دوباره تلاش کنید.");

        // اگه حساب غیرفعال بود (مثلاً مسدود شده)، اجازه ورود نده
        if (!user.IsActive)
            throw new UnauthorizedAccessException("نام کاربری یا رمز عبور نادرست است.");

        // رمز عبور رو چک کن - اگه اشتباه بود خطا بده
        if (!await _userMgr.CheckPasswordAsync(user, dto.Password))
        {
            await _userMgr.AccessFailedAsync(user);
            throw new UnauthorizedAccessException("نام کاربری یا رمز عبور نادرست است.");
        }

        await _userMgr.ResetAccessFailedCountAsync(user);

        // همه چیز درسته! توکن بساز و برگردون
        return await GenerateAuthResponse(user);
    }

    // ─── ثبت‌نام بیمار جدید ────────────────────────────────────
    public async Task<AuthResponseDto> RegisterPatientAsync(RegisterPatientDto dto, CancellationToken ct = default)
    {
        // چک کن این شماره موبایل قبلاً ثبت نشده باشه
        var existing = await _userMgr.FindByNameAsync(dto.PhoneNumber);
        if (existing != null)
            throw new InvalidOperationException("این شماره موبایل قبلاً ثبت شده است.");

        // کاربر جدید بساز
        var user = new ApplicationUser
        {
            UserName = dto.PhoneNumber,       // نام کاربری = شماره موبایل
            PhoneNumber = dto.PhoneNumber,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            FirstNameEn = dto.FirstNameEn ?? dto.FirstName,  // اگه انگلیسی نداشت، از فارسی استفاده کن
            LastNameEn = dto.LastNameEn ?? dto.LastName,
            Role = UserRole.Patient,   // نقش پیش‌فرض: بیمار
            IsActive = true,
            PhoneNumberConfirmed = true,  // شماره تأیید شده

            // همزمان پرونده بیمار هم بساز
            Patient = new Patient
            {
                NationalCode = dto.NationalCode,
                DateOfBirth = dto.DateOfBirth,
                Gender = dto.Gender,
            }
        };

        // کاربر رو با رمز عبور در دیتابیس ذخیره کن
        var result = await _userMgr.CreateAsync(user, dto.Password);

        // اگه خطایی بود (مثلاً رمز خیلی ساده بود) پیغام بده
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));

        // نقش "بیمار" رو به کاربر بده
        await _userMgr.AddToRoleAsync(user, nameof(UserRole.Patient));

        // توکن بساز و برگردون
        return await GenerateAuthResponse(user);
    }

    // ─── تمدید توکن (Refresh Token) ───────────────────────────
    // وقتی توکن اصلی (۶۰ دقیقه) منقضی شد، با این روش توکن جدید میگیریم
    // بدون اینکه کاربر دوباره رمز بزنه - مثل "به خاطر سپاری" در مرورگر
    public async Task<AuthResponseDto> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        // دنبال کاربری بگرد که این Refresh Token رو داره و هنوز منقضی نشده
        var user = await _userMgr.Users
            .FirstOrDefaultAsync(u =>
                u.RefreshToken == refreshToken &&
                u.RefreshTokenExpiry > DateTime.UtcNow, ct)
            ?? throw new UnauthorizedAccessException("Refresh token نامعتبر یا منقضی شده است.");

        // توکن جدید بساز
        return await GenerateAuthResponse(user);
    }

    // ─── خروج از سیستم ────────────────────────────────────────
    // Refresh Token رو پاک می‌کنیم تا کاربر نتونه توکن تمدید کنه
    public async Task<bool> LogoutAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userMgr.FindByIdAsync(userId.ToString());
        if (user == null) return false;

        // Refresh Token رو پاک کن - از این به بعد توکن جدید نمیشه گرفت
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;
        await _userMgr.UpdateAsync(user);
        return true;
    }

    // ─── تغییر رمز عبور ───────────────────────────────────────
    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto, CancellationToken ct = default)
    {
        var user = await _userMgr.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("کاربر یافت نشد.");

        // رمز قدیمی و جدید رو به UserManager بده تا تغییر بده
        var result = await _userMgr.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        return result.Succeeded;
    }

    // ─── دریافت پروفایل ───────────────────────────────────────
    public async Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default)
    {
        // Include(u => u.Patient) یعنی اطلاعات بیمار مرتبط رو هم بارگذاری کن
        var user = await _userMgr.Users
            .Include(u => u.Patient)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("کاربر یافت نشد.");

        return MapToProfile(user);
    }

    // ─── ویرایش پروفایل ───────────────────────────────────────
    public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto, CancellationToken ct = default)
    {
        var user = await _userMgr.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("کاربر یافت نشد.");

        // فقط فیلدهایی که فرستاده شدن رو آپدیت کن (null = تغییر نده)
        if (dto.FirstName != null) user.FirstName = dto.FirstName;
        if (dto.LastName != null) user.LastName = dto.LastName;
        if (dto.FirstNameEn != null) user.FirstNameEn = dto.FirstNameEn;
        if (dto.LastNameEn != null) user.LastNameEn = dto.LastNameEn;
        if (dto.ProfileImageUrl != null) user.ProfileImageUrl = dto.ProfileImageUrl;
        if (dto.NotifyViaSms.HasValue) user.NotifyViaSms = dto.NotifyViaSms.Value;
        if (dto.NotifyViaTelegram.HasValue) user.NotifyViaTelegram = dto.NotifyViaTelegram.Value;
        if (dto.NotifyViaWhatsApp.HasValue) user.NotifyViaWhatsApp = dto.NotifyViaWhatsApp.Value;

        await _userMgr.UpdateAsync(user);
        return MapToProfile(user);
    }

    // ═══ متدهای خصوصی (Helper) ═══════════════════════════════

    // این متد توکن JWT و Refresh Token می‌سازه و در دیتابیس ذخیره می‌کنه
    private async Task<AuthResponseDto> GenerateAuthResponse(ApplicationUser user)
    {
        user = await _userMgr.Users
            .Include(u => u.Patient)
            .SingleAsync(u => u.Id == user.Id);

        // نقش‌های کاربر رو بگیر (مثلاً: SuperAdmin)
        var roles = await _userMgr.GetRolesAsync(user);

        // توکن کوتاه مدت (۶۰ دقیقه) - برای هر درخواست API استفاده میشه
        var accessToken = _jwtService.GenerateAccessToken(user, roles);

        // توکن بلند مدت (۳۰ روز) - برای گرفتن توکن جدید بدون لاگین
        var refreshToken = _jwtService.GenerateRefreshToken();

        // Refresh Token رو در دیتابیس ذخیره کن
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(30);
        await _userMgr.UpdateAsync(user);

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddMinutes(60), // توکن اصلی ۶۰ دقیقه معتبره
            User = MapToProfile(user)
        };
    }

    // این متد اطلاعات کاربر رو به DTO تبدیل می‌کنه (فقط اطلاعات لازم، نه رمز عبور!)
    private static UserProfileDto MapToProfile(ApplicationUser u) => new()
    {
        Id = u.Id,
        FullName = u.FullName,
        FullNameEn = u.FullNameEn,
        PhoneNumber = u.PhoneNumber ?? string.Empty,
        Email = u.Email,
        Role = u.Role,
        ProfileImageUrl = u.ProfileImageUrl,
        NotifyViaSms = u.NotifyViaSms,
        NotifyViaTelegram = u.NotifyViaTelegram,
        NotifyViaWhatsApp = u.NotifyViaWhatsApp,
        PatientId = u.Patient?.Id  // اگه بیمار بود، ID پرونده بیمارش رو بده
    };
}
