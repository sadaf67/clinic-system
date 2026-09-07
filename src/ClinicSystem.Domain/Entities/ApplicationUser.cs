// ══════════════════════════════════════════════════════════════
// این کلاس اطلاعات هر کاربر سیستم رو نگه می‌داره
// کاربر می‌تونه دکتر، منشی یا بیمار باشه
// از IdentityUser ارث می‌بره یعنی قابلیت‌های لاگین، رمز عبور و... رو
// به صورت رایگان داره - نیازی نیست از صفر بنویسیمشون!
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace ClinicSystem.Domain.Entities;

// IdentityUser<Guid> یعنی از سیستم لاگین آماده‌ی مایکروسافت استفاده می‌کنیم
// و ID ما از نوع Guid هست (نه عدد ساده)
public class ApplicationUser : IdentityUser<Guid>
{
    // نام کوچک به فارسی (مثلاً: علی)
    public string FirstName { get; set; } = string.Empty;

    // نام خانوادگی به فارسی (مثلاً: رضایی)
    public string LastName { get; set; } = string.Empty;

    // نام کوچک به انگلیسی (مثلاً: Ali) - برای نسخه انگلیسی سایت
    public string FirstNameEn { get; set; } = string.Empty;

    // نام خانوادگی به انگلیسی (مثلاً: Rezaei)
    public string LastNameEn { get; set; } = string.Empty;

    // نقش این کاربر چیه؟ دکتر؟ منشی؟ بیمار؟
    public UserRole Role { get; set; } = UserRole.Patient;

    // لینک عکس پروفایل کاربر (اگه نداشت null میمونه)
    public string? ProfileImageUrl { get; set; }

    // آیا این حساب فعاله؟ اگه false باشه کاربر نمی‌تونه وارد بشه
    public bool IsActive { get; set; } = true;

    // تاریخ ثبت‌نام در سیستم
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // این توکن برای "به خاطر سپاری" لاگین استفاده میشه
    // وقتی توکن اصلی منقضی میشه، با این می‌تونیم توکن جدید بگیریم
    public string? RefreshToken { get; set; }

    // تاریخ انقضای RefreshToken - بعد از ۳۰ روز دیگه نمیشه ازش استفاده کرد
    public DateTime? RefreshTokenExpiry { get; set; }

    // آیدی چت تلگرام کاربر - برای ارسال پیام از طریق بات تلگرام
    public string? TelegramChatId { get; set; }

    // آیا به کاربر پیامک بزنیم؟ (پیش‌فرض: بله)
    public bool NotifyViaSms { get; set; } = true;

    // آیا به کاربر پیام تلگرام بزنیم؟ (پیش‌فرض: خیر)
    public bool NotifyViaTelegram { get; set; } = false;

    // آیا به کاربر پیام واتساپ بزنیم؟ (پیش‌فرض: خیر)
    public bool NotifyViaWhatsApp { get; set; } = false;

    // اسم کامل فارسی - به جای اینکه هر بار فارسی و انگلیسی رو جدا بنویسیم
    // این property اون‌ها رو کنار هم میذاره
    public string FullName => $"{FirstName} {LastName}";

    // اسم کامل انگلیسی
    public string FullNameEn => $"{FirstNameEn} {LastNameEn}";

    // اگه این کاربر بیمار باشه، اطلاعات بیمار مربوطه از اینجا قابل دسترسه
    // Navigation Property - EF Core این رو از دیتابیس بارگذاری می‌کنه
    public Patient? Patient { get; set; }
}
