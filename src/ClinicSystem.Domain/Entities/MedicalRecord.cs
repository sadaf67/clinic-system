// ══════════════════════════════════════════════════════════════
// این کلاس "پرونده پزشکی" هر ویزیت رو نگه می‌داره
// هر بار که دکتر بیمار رو ویزیت می‌کنه، یه پرونده جدید ساخته میشه
// شامل: علائم حیاتی، تشخیص، دارو، دستورات و...
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;

namespace ClinicSystem.Domain.Entities;

public class MedicalRecord : BaseEntity
{
    // این پرونده مال کدوم بیمار هست
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // این پرونده مربوط به کدوم نوبت بود (اختیاریه - می‌تونه بدون نوبت هم باشه)
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }

    // کدوم دکتر این پرونده رو نوشته
    public Guid DoctorId { get; set; }
    public ApplicationUser Doctor { get; set; } = null!;

    // تاریخ این ویزیت
    public DateTime VisitDate { get; set; } = DateTime.UtcNow;

    // ═══ علائم حیاتی در لحظه ویزیت ═════════════════════════
    // این‌ها اندازه‌گیری‌هایی هستن که دکتر/پرستار در ابتدای ویزیت انجام میده

    // وزن بیمار به کیلوگرم (مثلاً: 75.5)
    public decimal? Weight { get; set; }

    // قد بیمار به سانتی‌متر (مثلاً: 175.0)
    public decimal? Height { get; set; }

    // فشار خون سیستولیک - عدد بالایی (مثلاً: 120)
    public int? BloodPressureSystolic { get; set; }

    // فشار خون دیاستولیک - عدد پایینی (مثلاً: 80)
    public int? BloodPressureDiastolic { get; set; }

    // دمای بدن به سانتیگراد (نرمال: 36.5 تا 37.5)
    public decimal? Temperature { get; set; }

    // ضربان قلب - چند بار در دقیقه (نرمال: 60 تا 100)
    public int? HeartRate { get; set; }

    // درصد اشباع اکسیژن خون (باید بالای 95% باشه)
    public int? OxygenSaturation { get; set; }

    // قند خون (میلی‌گرم بر دسی‌لیتر)
    public decimal? BloodSugar { get; set; }

    // ═══ اطلاعات پزشکی ═══════════════════════════════════════

    // شکایت اصلی بیمار - برای چی اومده؟ (مثلاً: سردرد مکرر)
    public string? ChiefComplaint { get; set; }

    // تشخیص دکتر (مثلاً: میگرن، آنفلوانزا)
    public string? Diagnosis { get; set; }

    // کد استاندارد بیماری بر اساس ICD-10 (مثلاً: G43.0 برای میگرن)
    // این کدها در سراسر دنیا یکسانه
    public string? DiagnosisCode { get; set; }

    // برنامه درمانی - دکتر چه کاری توصیه کرده
    public string? TreatmentPlan { get; set; }

    // یادداشت‌های خصوصی دکتر
    public string? DoctorNotes { get; set; }

    // دستورات برای بیمار بعد از ویزیت (مثلاً: استراحت، رژیم غذایی)
    public string? FollowUpInstructions { get; set; }

    // تاریخ ویزیت بعدی (اگه نیاز به پیگیری باشه)
    public DateTime? NextVisitDate { get; set; }

    // ═══ فایل‌های ضمیمه ══════════════════════════════════════

    // آزمایشات، رادیوگرافی و فایل‌هایی که به این پرونده وصل شدن
    public ICollection<MedicalFile> Files { get; set; } = new List<MedicalFile>();

    // نسخه‌های دارویی که در این ویزیت نوشته شده
    public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();

    public ICollection<MedicalRecordVersion> Versions { get; set; } = new List<MedicalRecordVersion>();

    // ═══ محاسبات خودکار ══════════════════════════════════════

    // BMI = شاخص توده بدنی که از وزن و قد محاسبه میشه
    // فرمول: وزن(kg) تقسیم بر قد(m) به توان ۲
    // اگه وزن یا قد نداشتیم، null برمی‌گردونه
    public decimal? BMI => (Weight.HasValue && Height.HasValue && Height > 0)
        ? Math.Round(Weight.Value / (decimal)Math.Pow((double)(Height.Value / 100), 2), 1)
        : null;
}
