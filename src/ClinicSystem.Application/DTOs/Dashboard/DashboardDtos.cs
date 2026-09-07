// ══════════════════════════════════════════════════════════════
// DashboardDtos — کلاس‌های DTO داشبورد
//
// DTO = Data Transfer Object
// یعنی آبجکت‌هایی که فقط برای انتقال داده بین لایه‌ها استفاده
// میشن — مثل جعبه‌هایی که داده توشون بسته‌بندی میشه.
//
// این فایل DTOهای مربوط به داشبورد رو داره:
// - آمارهای کلی (کارت‌های بالای داشبورد)
// - داده نمودار هفتگی
// - داده نمودار ماهانه
// - نوبت‌های امروز (جدول پایین)
// ══════════════════════════════════════════════════════════════

namespace ClinicSystem.Application.DTOs.Dashboard;

// ──────────────────────────────────────────────────────────────
// DashboardStatsDto: همه آمارهای داشبورد در یه آبجکت
// این آبجکت کامل به frontend فرستاده میشه
// ──────────────────────────────────────────────────────────────
public class DashboardStatsDto
{
    public int TotalPatients          { get; set; } // کل بیماران ثبت‌شده
    public int TodayAppointments      { get; set; } // نوبت‌های امروز
    public int PendingAppointments    { get; set; } // نوبت‌های در انتظار تأیید
    public int PendingConsultations   { get; set; } // مشاوره‌های بی‌جواب
    public int NewPatientsThisMonth   { get; set; } // بیماران جدید این ماه
    public int CompletedVisitsThisMonth { get; set; } // ویزیت‌های انجام‌شده این ماه

    // داده نمودار میله‌ای هفتگی (۷ روز اخیر)
    public List<AppointmentChartDto> WeeklyAppointments { get; set; } = new();

    // داده نمودار خطی ماهانه (۶ ماه اخیر)
    public List<MonthlyPatientDto> MonthlyNewPatients { get; set; } = new();

    // نوبت‌های امروز برای جدول زیر داشبورد
    public List<UpcomingAppointmentDto> UpcomingToday { get; set; } = new();
}

// ──────────────────────────────────────────────────────────────
// AppointmentChartDto: داده یه روز برای نمودار هفتگی
// هر نقطه از نمودار میله‌ای یه شی از این کلاسه
// ──────────────────────────────────────────────────────────────
public class AppointmentChartDto
{
    public string Day   { get; set; } = string.Empty; // نام روز (فارسی: "شنبه")
    public string DayEn { get; set; } = string.Empty; // نام روز (انگلیسی: "Sat")
    public int Count    { get; set; }                  // تعداد کل نوبت‌ها
    public int Completed{ get; set; }                  // تعداد انجام‌شده
    public int Cancelled{ get; set; }                  // تعداد لغوشده
}

// ──────────────────────────────────────────────────────────────
// MonthlyPatientDto: داده یه ماه برای نمودار ماهانه
// نشون میده چند بیمار جدید توی هر ماه ثبت‌نام کردن
// ──────────────────────────────────────────────────────────────
public class MonthlyPatientDto
{
    public string Month  { get; set; } = string.Empty; // نام ماه (فارسی: "فروردین")
    public string MonthEn{ get; set; } = string.Empty; // نام ماه (انگلیسی: "Apr")
    public int Count     { get; set; }                  // تعداد بیماران جدید
}

// ──────────────────────────────────────────────────────────────
// UpcomingAppointmentDto: یه نوبت در جدول "نوبت‌های امروز"
// ──────────────────────────────────────────────────────────────
public class UpcomingAppointmentDto
{
    public Guid Id             { get; set; }                    // شناسه نوبت
    public string PatientName  { get; set; } = string.Empty;   // نام بیمار
    public TimeSpan StartTime  { get; set; }                    // ساعت شروع
    public string Type         { get; set; } = string.Empty;   // "InPerson" یا "Online"
    public string Status       { get; set; } = string.Empty;   // وضعیت
    public string? ChiefComplaint { get; set; }                 // علت مراجعه (اختیاری)
}
