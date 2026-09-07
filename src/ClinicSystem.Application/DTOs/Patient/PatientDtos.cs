// ══════════════════════════════════════════════════════════════
// PatientDtos — کلاس‌های DTO بیماران
//
// این فایل DTOهای مربوط به بیماران رو داره:
// - PatientDto: خلاصه اطلاعات بیمار (برای لیست)
// - PatientDetailDto: اطلاعات کامل بیمار (برای صفحه پروفایل)
// - UpdatePatientDto: ورودی ویرایش اطلاعات
// - VitalTrendDto: روند علائم حیاتی (برای نمودار)
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Application.DTOs.Patient;

// ──────────────────────────────────────────────────────────────
// PatientDto: خلاصه اطلاعات بیمار برای نمایش در لیست کارت‌ها
// ──────────────────────────────────────────────────────────────
public class PatientDto
{
    public Guid Id              { get; set; }                  // شناسه بیمار (جدول Patient)
    public Guid UserId          { get; set; }                  // شناسه کاربری (جدول User)
    public string FullName      { get; set; } = string.Empty; // نام کامل (نام + نام خانوادگی)
    public string PhoneNumber   { get; set; } = string.Empty; // شماره موبایل
    public string NationalCode  { get; set; } = string.Empty; // کد ملی
    public DateTime DateOfBirth { get; set; }                  // تاریخ تولد
    public int Age              { get; set; }                  // سن (خودکار محاسبه میشه)
    public Gender Gender        { get; set; }                  // Male، Female، Other
    public string? BloodType    { get; set; }                  // گروه خونی (A+، B- و...)
    public string? Address      { get; set; }                  // آدرس
    public string? InsuranceProvider { get; set; }             // نام بیمه (تأمین اجتماعی و...)
    public string? InsuranceCode     { get; set; }             // کد بیمه
    public int TotalVisits      { get; set; }                  // تعداد کل ویزیت‌ها
    public DateTime? LastVisitDate { get; set; }               // تاریخ آخرین ویزیت
}

// ──────────────────────────────────────────────────────────────
// PatientDetailDto: اطلاعات کامل بیمار (صفحه پروفایل بیمار)
// از PatientDto ارث میبره + اطلاعات پزشکی بیشتر
// ──────────────────────────────────────────────────────────────
public class PatientDetailDto : PatientDto
{
    public string? Allergies              { get; set; } // آلرژی‌ها (دارویی، غذایی)
    public string? ChronicDiseases        { get; set; } // بیماری‌های مزمن (دیابت، فشار خون)
    public string? CurrentMedications     { get; set; } // داروهای جاری (الان مصرف می‌کنه)
    public string? FamilyHistory          { get; set; } // سابقه خانوادگی (بیماری‌های موروثی)
    public string? EmergencyContactName   { get; set; } // نام تماس اضطراری
    public string? EmergencyContactPhone  { get; set; } // شماره تماس اضطراری
    public List<VitalSignSummaryDto> RecentVitals { get; set; } = new(); // آخرین علائم حیاتی
}

// ──────────────────────────────────────────────────────────────
// VitalSignSummaryDto: خلاصه یه علامت حیاتی (برای کارت‌های کوچیک)
// ──────────────────────────────────────────────────────────────
public class VitalSignSummaryDto
{
    public VitalTrendType Type  { get; set; } // نوع: Weight، BloodPressure و...
    public decimal Value        { get; set; } // مقدار: مثلاً 120 (mmHg)
    public string? Unit         { get; set; } // واحد: kg، mmHg، bpm و...
    public DateTime RecordedAt  { get; set; } // زمان ثبت
}

// ──────────────────────────────────────────────────────────────
// UpdatePatientDto: ورودی ویرایش اطلاعات بیمار
// فقط فیلدهایی که بیمار/دکتر می‌تونن ویرایش کنن
// (نه نام، کد ملی و... که باید رسمی تغییر کنن)
// ──────────────────────────────────────────────────────────────
public class UpdatePatientDto
{
    public string? Address               { get; set; } // آدرس جدید
    public string? EmergencyContactName  { get; set; } // نام تماس اضطراری
    public string? EmergencyContactPhone { get; set; } // شماره تماس اضطراری
    public string? BloodType             { get; set; } // گروه خونی
    public string? Allergies             { get; set; } // آلرژی‌ها
    public string? ChronicDiseases       { get; set; } // بیماری‌های مزمن
    public string? CurrentMedications    { get; set; } // داروهای جاری
    public string? FamilyHistory         { get; set; } // سابقه خانوادگی
    public string? InsuranceCode         { get; set; } // کد بیمه
    public string? InsuranceProvider     { get; set; } // نام بیمه
}

// ──────────────────────────────────────────────────────────────
// VitalTrendDto: روند یه علامت حیاتی در طول زمان
// برای رسم نمودار خطی توی صفحه بیمار استفاده میشه
// ──────────────────────────────────────────────────────────────
public class VitalTrendDto
{
    public VitalTrendType Type   { get; set; }                 // نوع علامت (Weight و...)
    public string Label          { get; set; } = string.Empty; // نام نمایشی ("وزن"، "فشار خون")
    public string? Unit          { get; set; }                 // واحد اندازه‌گیری
    public List<VitalDataPointDto> DataPoints { get; set; } = new(); // نقاط نمودار
    public decimal? Min          { get; set; }                 // کمترین مقدار ثبت‌شده
    public decimal? Max          { get; set; }                 // بیشترین مقدار ثبت‌شده
    public decimal? Average      { get; set; }                 // میانگین
    public string TrendDirection { get; set; } = "stable";    // روند: "up" | "down" | "stable"
}

// ──────────────────────────────────────────────────────────────
// VitalDataPointDto: یه نقطه روی نمودار علائم حیاتی
// هر بار که علامت حیاتی ثبت میشه، یه VitalDataPoint میشه
// ──────────────────────────────────────────────────────────────
public class VitalDataPointDto
{
    public DateTime Date { get; set; }   // تاریخ ثبت (محور X نمودار)
    public decimal Value { get; set; }   // مقدار (محور Y نمودار)
    public string? Notes { get; set; }   // یادداشت اضافی (اختیاری)
}
