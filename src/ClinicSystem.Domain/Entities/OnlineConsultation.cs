// ══════════════════════════════════════════════════════════════
// این فایل مشاوره آنلاین رو مدیریت می‌کنه
// بیمار یه سوال می‌پرسه، دکتر جواب میده - مثل یه تیکت پشتیبانی
// علاوه بر سوال و جواب، یه سیستم چت هم داریم (ConsultationMessage)
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

// ─── مشاوره آنلاین ────────────────────────────────────────────
public class OnlineConsultation : BaseEntity
{
    // این مشاوره مال کدوم بیمار هست
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // با کدوم دکتر مشاوره انجام میشه
    public Guid DoctorId { get; set; }
    public ApplicationUser Doctor { get; set; } = null!;

    // وضعیت مشاوره: در انتظار، در حال انجام، تموم شد، لغو شد
    public ConsultationStatus Status { get; set; } = ConsultationStatus.Waiting;

    // سوالی که بیمار پرسیده
    public string? PatientQuestion { get; set; }

    // جواب دکتر به سوال بیمار
    public string? DoctorAnswer { get; set; }

    // تاریخ و ساعتی که دکتر جواب داد
    public DateTime? AnsweredAt { get; set; }

    // تاریخ و ساعت درخواست مشاوره
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    // آیا این مشاوره فوری هست؟ (اورژانسی)
    public bool IsUrgent { get; set; } = false;

    // هزینه مشاوره (ریال)
    public decimal? Fee { get; set; }

    // آیا بیمار هزینه رو پرداخت کرده؟
    public bool IsPaid { get; set; } = false;

    // پیام‌های چت بین بیمار و دکتر - مثل واتساپ!
    public ICollection<ConsultationMessage> Messages { get; set; } = new List<ConsultationMessage>();

    // فایل‌هایی که بیمار ضمیمه کرده (مثلاً: عکس آزمایش، رادیوگرافی)
    public ICollection<MedicalFile> Attachments { get; set; } = new List<MedicalFile>();
}

// ─── پیام‌های چت داخل مشاوره ──────────────────────────────────
// هر پیامی که توی چت مشاوره فرستاده میشه اینجا ذخیره میشه
public class ConsultationMessage : BaseEntity
{
    // این پیام مربوط به کدوم مشاوره هست
    public Guid ConsultationId { get; set; }
    public OnlineConsultation Consultation { get; set; } = null!;

    // شناسه فرستنده پیام
    public Guid SenderId { get; set; }

    // نام فرستنده (برای نمایش در چت)
    public string SenderName { get; set; } = string.Empty;

    // آیا فرستنده دکتر هست؟ true = دکتر، false = بیمار
    // با این می‌فهمیم پیام سمت راست باشه یا سمت چپ نمایش داده بشه
    public bool IsDoctor { get; set; }

    // متن پیام
    public string Content { get; set; } = string.Empty;

    // آیا گیرنده این پیام رو خونده؟ (تیک آبی!)
    public bool IsRead { get; set; } = false;

    // تاریخ و ساعت ارسال پیام
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
