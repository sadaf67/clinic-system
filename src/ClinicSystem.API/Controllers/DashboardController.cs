// ══════════════════════════════════════════════════════════════
// DashboardController — کنترلر داشبورد
//
// این کنترلر آمارهایی رو که دکتر/منشی توی داشبورد می‌بینه
// حساب می‌کنه و برمیگردونه.
//
// دسترسی: فقط SuperAdmin (دکتر) و Admin (منشی)
// آدرس: GET /api/dashboard/stats
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.DTOs.Dashboard;
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

// [ApiController] = این کلاس یه کنترلر API هست
// [Route("api/[controller]")] = آدرس: /api/dashboard
// [Authorize(Roles = ...)] = فقط دکتر یا منشی می‌تونن وارد بشن
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin,Admin")]
public class DashboardController : ControllerBase
{
    // ── ریپازیتوری‌ها — ابزارهای خوندن از دیتابیس ───────────────
    private readonly IPatientRepository _patientRepo;           // برای کار با بیماران
    private readonly IAppointmentRepository _appointmentRepo;   // برای کار با نوبت‌ها
    private readonly IGenericRepository<OnlineConsultation> _consultationRepo; // برای مشاوره‌ها

    // ── سازنده (Constructor) — تزریق وابستگی‌ها ─────────────────
    // ASP.NET این ریپازیتوری‌ها رو خودش میسازه و میده
    public DashboardController(
        IPatientRepository patientRepo,
        IAppointmentRepository appointmentRepo,
        IGenericRepository<OnlineConsultation> consultationRepo)
    {
        _patientRepo = patientRepo;
        _appointmentRepo = appointmentRepo;
        _consultationRepo = consultationRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // GetStats: دریافت تمام آمار داشبورد
    // آدرس: GET /api/dashboard/stats
    // خروجی: یه آبجکت DashboardStatsDto با تمام عددها و نمودارها
    // ──────────────────────────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats(CancellationToken ct)
    {
        // شناسه دکتر لاگین‌شده رو از توکن JWT می‌خونیم
        var doctorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // تاریخ امروز (بدون ساعت) و اول ماه جاری
        var today = DateTime.UtcNow.Date;
        var monthStart = new DateTime(today.Year, today.Month, 1);

        // ── کوئری‌های ترتیبی (نه موازی) ─────────────────────────
        // توجه: اگه همزمان چند کوئری بزنیم (Task.WhenAll)، DbContext
        // خطای threading میده — پس یه‌به‌یه اجرا می‌کنیم

        // ۱. تعداد کل بیماران
        var totalPatients = await _patientRepo.CountAsync(null, ct);

        // ۲. تعداد نوبت‌های امروز این دکتر
        var todayApptCount = await _appointmentRepo.CountAsync(
            a => a.DoctorId == doctorId && a.AppointmentDate.Date == today, ct);

        // ۳. تعداد نوبت‌های در انتظار تأیید
        var pendingApptCount = await _appointmentRepo.CountAsync(
            a => a.DoctorId == doctorId && a.Status == AppointmentStatus.Pending, ct);

        // ۴. تعداد مشاوره‌های در انتظار پاسخ
        var pendingConsultCount = await _consultationRepo.CountAsync(
            c => c.Status == ConsultationStatus.Waiting, ct);

        // ۵. بیماران جدید این ماه
        var newPatientsCount = await _patientRepo.CountAsync(
            p => p.CreatedAt >= monthStart, ct);

        // ۶. ویزیت‌های انجام‌شده این ماه (Completed)
        var completedVisits = await _appointmentRepo.CountAsync(
            a => a.DoctorId == doctorId &&
                 a.Status == AppointmentStatus.Completed &&
                 a.AppointmentDate >= monthStart, ct);

        // ── نمودار هفتگی (۷ روز اخیر) ───────────────────────────
        // weekStart = ۶ روز پیش (تا امروز = ۷ روز کامل)
        var weekStart = today.AddDays(-6);
        var weekAppts = await _appointmentRepo.GetByDateRangeAsync(weekStart, today, ct);

        // برای هر روز از ۷ روز: تعداد کل، انجام‌شده، لغوشده
        var weeklyChart = Enumerable.Range(0, 7).Select(i =>
        {
            var date = weekStart.AddDays(i);
            var dayAppts = weekAppts.Where(a => a.AppointmentDate.Date == date).ToList();
            return new AppointmentChartDto
            {
                Day    = date.ToString("ddd", new System.Globalization.CultureInfo("fa-IR")), // نام روز فارسی
                DayEn  = date.ToString("ddd"),                                                 // نام روز انگلیسی
                Count  = dayAppts.Count,
                Completed = dayAppts.Count(a => a.Status == AppointmentStatus.Completed),
                Cancelled = dayAppts.Count(a => a.Status == AppointmentStatus.Cancelled),
            };
        }).ToList();

        // ── نمودار ماهانه (۶ ماه اخیر) ──────────────────────────
        // تعداد بیماران جدید در هر ماه از ۶ ماه گذشته تا الان
        var monthlyPatients = new List<MonthlyPatientDto>();
        for (int i = 5; i >= 0; i--) // از ۵ ماه پیش تا ماه جاری (i=0)
        {
            var mStart = monthStart.AddMonths(-i);
            var mEnd   = mStart.AddMonths(1);
            var count  = await _patientRepo.CountAsync(
                p => p.CreatedAt >= mStart && p.CreatedAt < mEnd, ct);

            monthlyPatients.Add(new MonthlyPatientDto
            {
                Month   = mStart.ToString("MMMM", new System.Globalization.CultureInfo("fa-IR")), // فروردین، اردیبهشت...
                MonthEn = mStart.ToString("MMM"),                                                    // Jan, Feb...
                Count   = count
            });
        }

        // ── نوبت‌های امروز (برای جدول زیر داشبورد) ──────────────
        // همه نوبت‌های امروز رو میگیره، لغوشده‌ها رو حذف می‌کنه
        // ۱۰ تا اول بر اساس ساعت مرتب میشن
        var todayAppts = await _appointmentRepo.GetByDoctorIdAsync(doctorId, today, ct);
        var upcoming = todayAppts
            .Where(a => a.Status != AppointmentStatus.Cancelled)
            .OrderBy(a => a.StartTime)
            .Take(10)
            .Select(a => new UpcomingAppointmentDto
            {
                Id             = a.Id,
                PatientName    = a.Patient?.User?.FullName ?? string.Empty,
                StartTime      = a.StartTime,
                Type           = a.Type.ToString(),    // "InPerson" یا "Online"
                Status         = a.Status.ToString(),  // "Pending"، "Confirmed" و...
                ChiefComplaint = a.ChiefComplaint       // علت مراجعه
            }).ToList();

        // همه چیز رو یه‌جا برمیگردونیم
        return Ok(new DashboardStatsDto
        {
            TotalPatients           = totalPatients,
            TodayAppointments       = todayApptCount,
            PendingAppointments     = pendingApptCount,
            PendingConsultations    = pendingConsultCount,
            NewPatientsThisMonth    = newPatientsCount,
            CompletedVisitsThisMonth= completedVisits,
            WeeklyAppointments      = weeklyChart,
            MonthlyNewPatients      = monthlyPatients,
            UpcomingToday           = upcoming
        });
    }
}
