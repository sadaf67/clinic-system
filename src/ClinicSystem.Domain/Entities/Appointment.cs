// ══════════════════════════════════════════════════════════════
// این کلاس اطلاعات یه نوبت پزشکی رو نگه می‌داره
// وقتی یه بیمار نوبت می‌گیره، یه رکورد از این جدول ساخته میشه
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class Appointment : BaseEntity
{
    public Guid? BranchId { get; set; }
    public ClinicBranch? Branch { get; set; }

    // شناسه بیماری که نوبت گرفته
    public Guid PatientId { get; set; }

    // آبجکت کامل بیمار - برای اینکه بتونیم اسم بیمار و... رو بخونیم
    public Patient Patient { get; set; } = null!;

    // شناسه دکتری که نوبت پیشش هست
    public Guid DoctorId { get; set; }

    // آبجکت کامل دکتر
    public ApplicationUser Doctor { get; set; } = null!;

    // تاریخ نوبت (مثلاً: ۱۵ خرداد ۱۴۰۵)
    public DateTime AppointmentDate { get; set; }

    // ساعت شروع نوبت (مثلاً: ۰۹:۰۰)
    public TimeSpan StartTime { get; set; }

    // ساعت پایان نوبت (مثلاً: ۰۹:۳۰) - خودکار محاسبه میشه
    public TimeSpan EndTime { get; set; }

    // وضعیت فعلی نوبت: در انتظار؟ تأیید شده؟ لغو شده؟ انجام شده؟
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Pending;

    // نوع ویزیت: حضوری یا آنلاین؟
    public AppointmentType Type { get; set; } = AppointmentType.InPerson;

    // بیمار برای چی اومده؟ (مثلاً: سردرد، درد پا)
    public string? ChiefComplaint { get; set; }

    // یادداشت‌های اضافه درباره این نوبت
    public string? Notes { get; set; }

    // آیا یادآور (پیامک یا تلگرام) برای این نوبت فرستاده شده؟
    public bool ReminderSent { get; set; } = false;

    // کِی یادآور فرستاده شد
    public DateTime? ReminderSentAt { get; set; }

    // ═══ فقط برای ویزیت آنلاین ══════════════════════════════

    // لینک ورود به جلسه ویدیویی (مثلاً لینک گوگل‌میت)
    public string? MeetingLink { get; set; }

    // کد اتاق ویدیو
    public string? MeetingId { get; set; }

    // ═══ بعد از ویزیت ════════════════════════════════════════

    // پرونده پزشکی که بعد از این نوبت ساخته میشه
    public MedicalRecord? MedicalRecord { get; set; }
    public VisitQueueItem? QueueItem { get; set; }
    public TelemedicineSession? TelemedicineSession { get; set; }

    // ═══ منطق تجاری ══════════════════════════════════════════

    // این property چک می‌کنه که آیا الان وقت ارسال یادآور هست یا نه
    // شرط‌ها: هنوز یادآور نفرستادیم AND نوبت تأیید شده AND نوبت فرداست
    public bool IsReminderDue =>
        !ReminderSent &&
        Status == AppointmentStatus.Confirmed &&
        AppointmentDate.Date == DateTime.UtcNow.AddDays(1).Date;
}
