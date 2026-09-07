// ══════════════════════════════════════════════════════════════
// این فایل دو کلاس داره:
// 1. Prescription: خود نسخه (مثلاً نسخه شماره RX-20260615-ABC)
// 2. PrescriptionItem: هر دارویی که توی نسخه نوشته شده
// یه نسخه می‌تونه چند دارو داشته باشه
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

// ─── خود نسخه ─────────────────────────────────────────────────
public class Prescription : BaseEntity
{
    // این نسخه برای کدوم بیمار هست
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // کدوم دکتر این نسخه رو نوشته
    public Guid DoctorId { get; set; }
    public ApplicationUser Doctor { get; set; } = null!;

    // این نسخه مربوط به کدوم ویزیت بود (اختیاریه)
    public Guid? MedicalRecordId { get; set; }
    public MedicalRecord? MedicalRecord { get; set; }

    // تاریخ صدور نسخه
    public DateTime IssuedDate { get; set; } = DateTime.UtcNow;

    // تاریخ انقضای نسخه - بعد از این تاریخ دیگه معتبر نیست
    public DateTime ExpiryDate { get; set; }

    // وضعیت نسخه: فعال، منقضی یا لغو شده
    public PrescriptionStatus Status { get; set; } = PrescriptionStatus.Active;

    // یادداشت دکتر روی نسخه (مثلاً: با معده خالی مصرف نشود)
    public string? Notes { get; set; }

    // کد یکتای نسخه که چاپ میشه (مثلاً: RX-20260615-A3F2B1)
    public string? PrescriptionCode { get; set; }

    // لیست داروهایی که توی این نسخه هست
    // یه نسخه می‌تونه چند دارو داشته باشه
    public ICollection<PrescriptionItem> Items { get; set; } = new List<PrescriptionItem>();
}

// ─── هر دارو در نسخه ──────────────────────────────────────────
// مثلاً "آموکسی‌سیلین ۵۰۰ میلی‌گرم، هر ۸ ساعت، ۷ روز"
public class PrescriptionItem : BaseEntity
{
    // این قلم دارو متعلق به کدوم نسخه است
    public Guid PrescriptionId { get; set; }
    public Prescription Prescription { get; set; } = null!;

    // نام دارو به فارسی (مثلاً: آموکسی‌سیلین)
    public string MedicineName { get; set; } = string.Empty;

    // نام دارو به انگلیسی (مثلاً: Amoxicillin)
    public string MedicineNameEn { get; set; } = string.Empty;

    // دوز دارو (مثلاً: ۵۰۰ میلی‌گرم)
    public string Dosage { get; set; } = string.Empty;

    // دفعات مصرف (مثلاً: هر ۸ ساعت یک بار، سه بار در روز)
    public string Frequency { get; set; } = string.Empty;

    // مدت مصرف (مثلاً: ۷ روز، ۱ ماه)
    public string Duration { get; set; } = string.Empty;

    // دستورالعمل مصرف (مثلاً: همراه غذا، با آب فراوان)
    public string? Instructions { get; set; }

    // تعداد کل قرص/کپسول که باید از داروخانه گرفته بشه
    public int Quantity { get; set; }
}
