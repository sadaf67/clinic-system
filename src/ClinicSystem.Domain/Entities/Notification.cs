// ══════════════════════════════════════════════════════════════
// این کلاس هر اعلانی که سیستم می‌فرسته رو ذخیره می‌کنه
// مثلاً: "نوبت شما فردا ساعت ۱۰ صبح هست"
// این اعلان می‌تونه از طریق پیامک، تلگرام، واتساپ یا داخل سایت فرستاده بشه
// ذخیره کردن اعلان‌ها کمک می‌کنه بفهمیم کِی فرستادیم، رسید یا نرسید
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class Notification : BaseEntity
{
    // این اعلان برای کدوم کاربر هست
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;

    // از چه روشی فرستاده بشه؟ پیامک؟ تلگرام؟ واتساپ؟ داخل سایت؟
    public NotificationType Type { get; set; }

    // وضعیت: در انتظار ارسال، فرستاده شد، خطا داشت
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;

    // عنوان اعلان به فارسی (مثلاً: یادآوری نوبت)
    public string Title { get; set; } = string.Empty;

    // عنوان اعلان به انگلیسی
    public string TitleEn { get; set; } = string.Empty;

    // متن کامل اعلان به فارسی
    public string Message { get; set; } = string.Empty;

    // متن کامل اعلان به انگلیسی
    public string MessageEn { get; set; } = string.Empty;

    // کِی ارسال شد (null یعنی هنوز نفرستاده)
    public DateTime? SentAt { get; set; }

    // اگه خطا داشت، پیغام خطا اینجا ذخیره میشه
    public string? ErrorMessage { get; set; }

    // این اعلان مربوط به کدوم موجودیت هست؟ (مثلاً: ID نوبت)
    public Guid? RelatedEntityId { get; set; }

    // نوع موجودیت مرتبط (مثلاً: "Appointment" یا "Prescription")
    public string? RelatedEntityType { get; set; }

    // آیا کاربر این اعلان رو خونده؟ (برای اعلان‌های داخل سایت)
    public bool IsRead { get; set; } = false;

    // چند بار تلاش کردیم بفرستیم؟ اگه بار اول نرفت، دوباره امتحان می‌کنیم
    public int RetryCount { get; set; } = 0;
}
