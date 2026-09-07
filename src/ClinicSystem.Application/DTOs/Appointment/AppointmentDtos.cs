// ══════════════════════════════════════════════════════════════
// AppointmentDtos — کلاس‌های DTO نوبت‌ها
//
// این فایل همه DTOهای مربوط به نوبت‌ها رو داره:
// - AppointmentDto: اطلاعات یه نوبت (برای نمایش)
// - CreateAppointmentDto: ورودی برای ثبت نوبت جدید
// - UpdateAppointmentDto: ورودی برای ویرایش نوبت
// - UpdateAppointmentStatusDto: تغییر وضعیت نوبت
// - AppointmentFilterDto: فیلترهای لیست نوبت‌ها
// - AvailableSlotDto: یه اسلات زمانی آزاد
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Application.DTOs.Appointment;

// ──────────────────────────────────────────────────────────────
// AppointmentDto: اطلاعات کامل یه نوبت برای نمایش
// این رو از API دریافت می‌کنیم و به frontend میفرستیم
// ──────────────────────────────────────────────────────────────
public class AppointmentDto
{
    public Guid Id             { get; set; }                   // شناسه یکتا
    public Guid PatientId      { get; set; }                   // شناسه بیمار
    public string PatientName  { get; set; } = string.Empty;  // نام بیمار (برای نمایش)
    public string PatientPhone { get; set; } = string.Empty;  // شماره موبایل بیمار
    public Guid DoctorId       { get; set; }                   // شناسه دکتر
    public Guid? BranchId      { get; set; }
    public string DoctorName   { get; set; } = string.Empty;  // نام دکتر
    public DateTime AppointmentDate { get; set; }              // تاریخ نوبت
    public TimeSpan StartTime  { get; set; }                   // ساعت شروع (مثل 09:00)
    public TimeSpan EndTime    { get; set; }                   // ساعت پایان (مثل 09:30)
    public AppointmentStatus Status { get; set; }              // وضعیت: Pending، Confirmed و...
    public AppointmentType Type { get; set; }                  // InPerson یا Online
    public string? ChiefComplaint { get; set; }                // علت مراجعه (اختیاری)
    public string? Notes          { get; set; }                // یادداشت (اختیاری)
    public string? MeetingLink    { get; set; }                // لینک ویدیوکنفرانس (فقط Online)
    public DateTime CreatedAt { get; set; }                    // زمان ثبت نوبت
}

// ──────────────────────────────────────────────────────────────
// CreateAppointmentDto: ورودی ثبت نوبت جدید
// بیمار یا منشی این رو پر می‌کنن
// ──────────────────────────────────────────────────────────────
public class CreateAppointmentDto
{
    public Guid PatientId          { get; set; }               // بیمار (اجباری)
    public Guid DoctorId           { get; set; }               // دکتر (اجباری)
    public Guid? BranchId          { get; set; }
    public DateTime AppointmentDate { get; set; }              // تاریخ (اجباری)
    public TimeSpan StartTime       { get; set; }              // ساعت شروع (اجباری)
    public AppointmentType Type { get; set; } = AppointmentType.InPerson; // پیش‌فرض: حضوری
    public string? ChiefComplaint   { get; set; }              // علت مراجعه (اختیاری)
    public string? Notes            { get; set; }              // یادداشت (اختیاری)
}

// ──────────────────────────────────────────────────────────────
// UpdateAppointmentDto: ورودی ویرایش نوبت موجود
// هر فیلد nullable هست — یعنی اگه null بود، تغییر نمیده
// ──────────────────────────────────────────────────────────────
public class UpdateAppointmentDto
{
    public DateTime? AppointmentDate { get; set; } // اگه null → بدون تغییر
    public TimeSpan? StartTime       { get; set; }
    public Guid? BranchId            { get; set; }
    public AppointmentType? Type     { get; set; }
    public string? ChiefComplaint    { get; set; }
    public string? Notes             { get; set; }
    public string? MeetingLink       { get; set; }
}

// ──────────────────────────────────────────────────────────────
// UpdateAppointmentStatusDto: تغییر وضعیت نوبت
// مثلاً: Pending → Confirmed یا → Cancelled
// ──────────────────────────────────────────────────────────────
public class UpdateAppointmentStatusDto
{
    public AppointmentStatus Status { get; set; } // وضعیت جدید (اجباری)
    public string? Notes { get; set; }             // یادداشت (اختیاری — مثلاً دلیل لغو)
}

// ──────────────────────────────────────────────────────────────
// AppointmentFilterDto: فیلترهای لیست نوبت‌ها
// بر اساس هر کدام که مقدار داشته باشن، فیلتر میشه
// ──────────────────────────────────────────────────────────────
public class AppointmentFilterDto
{
    public Guid? DoctorId           { get; set; } // فیلتر بر اساس دکتر
    public Guid? PatientId          { get; set; } // فیلتر بر اساس بیمار
    public AppointmentStatus? Status { get; set; } // فیلتر وضعیت
    public DateTime? From           { get; set; } // از این تاریخ
    public DateTime? To             { get; set; } // تا این تاریخ
    public int Page     { get; set; } = 1;         // شماره صفحه (پیش‌فرض ۱)
    public int PageSize { get; set; } = 20;        // تعداد در هر صفحه (پیش‌فرض ۲۰)
}

// ──────────────────────────────────────────────────────────────
// AvailableSlotDto: یه اسلات زمانی در تقویم دکتر
// برای نشون دادن "ساعت‌های خالی" وقتی بیمار نوبت می‌گیره
// ──────────────────────────────────────────────────────────────
public class AvailableSlotDto
{
    public TimeSpan StartTime  { get; set; } // شروع اسلات (مثل 10:00)
    public TimeSpan EndTime    { get; set; } // پایان اسلات (مثل 10:30)
    public bool IsAvailable    { get; set; } // true = آزاد، false = رزرو شده
}
