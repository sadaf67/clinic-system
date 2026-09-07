// ══════════════════════════════════════════════════════════════
// این کلاس فایل‌های پزشکی رو مدیریت می‌کنه
// مثلاً: عکس رادیوگرافی، نتیجه آزمایش، اسکن MRI
// یه فایل می‌تونه به یه پرونده پزشکی یا به یه مشاوره آنلاین وصل باشه
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class MedicalFile : BaseEntity
{
    // این فایل به کدوم پرونده پزشکی وصل هست (اختیاریه)
    public Guid? MedicalRecordId { get; set; }
    public MedicalRecord? MedicalRecord { get; set; }

    // این فایل به کدوم مشاوره آنلاین وصل هست (اختیاریه)
    // یه فایل یا به پرونده وصله یا به مشاوره، نه هر دو
    public Guid? ConsultationId { get; set; }
    public OnlineConsultation? Consultation { get; set; }

    // این فایل رو کدوم کاربر آپلود کرده
    public Guid UploadedByUserId { get; set; }

    // نام فایل اصلی (مثلاً: chest-xray.jpg)
    public string FileName { get; set; } = string.Empty;

    // آدرس اینترنتی فایل در سرور (URL که می‌شه باهاش فایل رو دانلود کرد)
    public string FileUrl { get; set; } = string.Empty;

    // کلید داخلی ذخیره‌سازی؛ مسیر فیزیکی هرگز مستقیماً به کاربر برگردانده نمی‌شود.
    public string StorageKey { get; set; } = string.Empty;

    public string Sha256 { get; set; } = string.Empty;

    public FileScanStatus ScanStatus { get; set; } = FileScanStatus.Pending;

    public string? ScanMessage { get; set; }

    // نوع فایل (مثلاً: image/jpeg، application/pdf)
    public string FileType { get; set; } = string.Empty;

    // حجم فایل به بایت (برای نمایش مثلاً: 2.5 MB)
    public long FileSizeBytes { get; set; }

    // توضیح درباره این فایل (مثلاً: "رادیوگرافی قفسه سینه - نمای PA")
    public string? Description { get; set; }

    // تاریخ و ساعت آپلود
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
