// ══════════════════════════════════════════════════════════════
// این کلاس اطلاعات پزشکی بیمار رو نگه می‌داره
// توجه کن که ApplicationUser اطلاعات لاگین رو داره (شماره، رمز)
// و Patient اطلاعات پزشکی رو (کد ملی، گروه خون، آلرژی و...)
// این دو تا به هم وصل هستن از طریق UserId
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class Patient : BaseEntity // از BaseEntity ارث می‌بره یعنی Id و CreatedAt و... داره
{
    // شناسه کاربر مرتبط با این بیمار - این رابطه بین Patient و ApplicationUser هست
    public Guid UserId { get; set; }

    // خود آبجکت کاربر - EF Core این رو از دیتابیس بارگذاری می‌کنه
    // null! یعنی مطمئنیم هیچوقت null نیست (EF آن رو پر می‌کنه)
    public ApplicationUser User { get; set; } = null!;

    // ═══ اطلاعات شخصی ════════════════════════════════════════

    // کد ملی ۱۰ رقمی - باید یکتا باشه (دو بیمار با یه کد ملی نمیشه)
    public string NationalCode { get; set; } = string.Empty;

    // تاریخ تولد - برای محاسبه سن استفاده میشه
    public DateTime DateOfBirth { get; set; }

    // جنسیت بیمار
    public Gender Gender { get; set; }

    // آدرس منزل بیمار (اختیاریه)
    public string? Address { get; set; }

    // نام کسی که باید در شرایط اضطراری باهاش تماس گرفت (مثلاً: همسر بیمار)
    public string? EmergencyContactName { get; set; }

    // شماره تماس اضطراری
    public string? EmergencyContactPhone { get; set; }

    // گروه خونی (مثلاً: A+، B-، O+)
    public string? BloodType { get; set; }

    // ═══ سابقه پزشکی ═════════════════════════════════════════

    // آلرژی‌های بیمار (مثلاً: آلرژی به پنی‌سیلین)
    public string? Allergies { get; set; }

    // بیماری‌های مزمن (مثلاً: دیابت، فشار خون)
    public string? ChronicDiseases { get; set; }

    // داروهای فعلی که بیمار مصرف می‌کنه
    public string? CurrentMedications { get; set; }

    // سابقه بیماری در خانواده (مثلاً: پدر سرطان داشته)
    public string? FamilyHistory { get; set; }

    // کد بیمه بیمار
    public string? InsuranceCode { get; set; }

    // نام شرکت بیمه (مثلاً: تأمین اجتماعی، خدمات درمانی)
    public string? InsuranceProvider { get; set; }

    // ═══ روابط با جداول دیگه ═════════════════════════════════
    // این لیست‌ها وقتی نیاز باشه از دیتابیس بارگذاری میشن

    // همه نوبت‌های این بیمار
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();

    // همه پرونده‌های پزشکی این بیمار
    public ICollection<MedicalRecord> MedicalRecords { get; set; } = new List<MedicalRecord>();

    // همه نسخه‌های این بیمار
    public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();

    // تاریخچه علائم حیاتی (وزن، فشار خون و...) در طول زمان
    public ICollection<VitalSign> VitalSigns { get; set; } = new List<VitalSign>();

    // مشاوره‌های آنلاین این بیمار
    public ICollection<OnlineConsultation> Consultations { get; set; } = new List<OnlineConsultation>();

    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();

    // ═══ محاسبات ═════════════════════════════════════════════

    // سن بیمار رو از تاریخ تولدش حساب می‌کنه
    // تقسیم بر 365.25 چون سال کبیسه هم هست!
    public int Age => (int)((DateTime.UtcNow - DateOfBirth).TotalDays / 365.25);
}
