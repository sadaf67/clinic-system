// ══════════════════════════════════════════════════════════════
// AuthDtos — کلاس‌های DTO احراز هویت
//
// این فایل DTOهای مربوط به لاگین، ثبت‌نام و تغییر رمز رو داره.
//
// record = یه کلاس خلاصه در C# که:
// - فقط خواندنیه (immutable)
// - سازنده خودکار داره
// - مناسب برای ورودی‌های ساده
// ══════════════════════════════════════════════════════════════

using System.ComponentModel.DataAnnotations;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Application.DTOs.Auth;

// ──────────────────────────────────────────────────────────────
// LoginDto: ورودی صفحه لاگین
// کاربر نام کاربری (شماره موبایل) و رمز رو وارد می‌کنه
// ──────────────────────────────────────────────────────────────
public record LoginDto(
    [Required] string UserName,  // نام کاربری = شماره موبایل (09xxxxxxxxx)
    [Required] string Password   // رمز عبور
);

// ──────────────────────────────────────────────────────────────
// RegisterPatientDto: ورودی ثبت‌نام بیمار جدید
// [Required] = اجباری — اگه خالی باشه، API خطا میده
// [Phone] = فرمت شماره موبایل چک میشه
// ──────────────────────────────────────────────────────────────
public record RegisterPatientDto(
    [Required] string FirstName,       // نام (اجباری)
    [Required] string LastName,        // نام خانوادگی (اجباری)
    string? FirstNameEn,               // نام انگلیسی (اختیاری)
    string? LastNameEn,                // نام خانوادگی انگلیسی (اختیاری)
    [Required, Phone] string PhoneNumber, // موبایل — [Phone] فرمت رو چک می‌کنه
    [Required] string Password,        // رمز عبور (اجباری)
    [Required] string NationalCode,    // کد ملی ۱۰ رقمی (اجباری)
    DateTime DateOfBirth,              // تاریخ تولد
    Gender Gender                      // جنسیت: Male، Female، Other
);

// ──────────────────────────────────────────────────────────────
// ChangePasswordDto: ورودی تغییر رمز عبور
// باید رمز فعلی رو بدی تا بتونی رمز جدید بذاری
// [MinLength(6)] = رمز جدید حداقل ۶ کاراکتر باشه
// ──────────────────────────────────────────────────────────────
public record ChangePasswordDto(
    [Required] string CurrentPassword,          // رمز فعلی
    [Required, MinLength(6)] string NewPassword // رمز جدید (حداقل ۶ کاراکتر)
);

// ──────────────────────────────────────────────────────────────
// UpdateProfileDto: ورودی بروزرسانی پروفایل
// همه فیلدها nullable هستن — فقط فیلدهایی که داده شدن تغییر می‌کنن
// ──────────────────────────────────────────────────────────────
public record UpdateProfileDto(
    string? FirstName,          // نام
    string? LastName,           // نام خانوادگی
    string? FirstNameEn,        // نام انگلیسی
    string? LastNameEn,         // نام خانوادگی انگلیسی
    string? ProfileImageUrl,    // آدرس عکس پروفایل
    bool? NotifyViaSms,         // دریافت SMS؟
    bool? NotifyViaTelegram,    // دریافت پیام تلگرام؟
    bool? NotifyViaWhatsApp     // دریافت واتساپ؟
);

// ──────────────────────────────────────────────────────────────
// AuthResponseDto: پاسخ API بعد از لاگین موفق
// شامل توکن‌ها + اطلاعات کاربر
// ──────────────────────────────────────────────────────────────
public class AuthResponseDto
{
    // AccessToken: توکن کوتاه‌مدت (۶۰ دقیقه) — برای همه درخواست‌ها
    public string AccessToken  { get; set; } = string.Empty;

    // RefreshToken: توکن بلندمدت (۳۰ روز) — برای دریافت AccessToken جدید
    public string RefreshToken { get; set; } = string.Empty;

    // زمان انقضای AccessToken
    public DateTime ExpiresAt  { get; set; }

    // اطلاعات کاربر لاگین‌شده (برای نمایش در UI)
    public UserProfileDto User { get; set; } = null!;
}

// ──────────────────────────────────────────────────────────────
// UserProfileDto: اطلاعات پروفایل کاربر
// توی Zustand store ذخیره میشه و همه جا دردسترسه
// ──────────────────────────────────────────────────────────────
public class UserProfileDto
{
    public Guid Id                  { get; set; }                  // شناسه کاربر
    public string FullName          { get; set; } = string.Empty; // نام کامل (فارسی)
    public string FullNameEn        { get; set; } = string.Empty; // نام کامل (انگلیسی)
    public string PhoneNumber       { get; set; } = string.Empty; // شماره موبایل
    public string? Email            { get; set; }                  // ایمیل (اختیاری)
    public UserRole Role            { get; set; }                  // SuperAdmin، Admin، یا Patient
    public string? ProfileImageUrl  { get; set; }                  // آدرس عکس پروفایل
    public bool NotifyViaSms        { get; set; }                  // آیا SMS می‌خواد؟
    public bool NotifyViaTelegram   { get; set; }                  // آیا تلگرام می‌خواد؟
    public bool NotifyViaWhatsApp   { get; set; }                  // آیا واتساپ می‌خواد؟
    public Guid? PatientId          { get; set; }                  // اگه Patient هست، شناسه بیمارش
    // PatientId null یعنی Admin یا SuperAdmin هست (دکتر یا منشی)
}
