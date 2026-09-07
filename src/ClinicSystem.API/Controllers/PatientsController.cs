// ══════════════════════════════════════════════════════════════
// PatientsController = کنترلر بیماران
// مدیریت اطلاعات بیماران:
// - لیست بیماران (با جستجو و صفحه‌بندی)
// - مشاهده پرونده کامل بیمار
// - پروفایل خود بیمار
// - ویرایش اطلاعات بیمار
// - مشاهده و ثبت علائم حیاتی (وزن، فشار، قند و...)
//
// آدرس‌ها: /api/patients/...
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.DTOs.Patient;
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PatientsController : ControllerBase
{
    private readonly IPatientRepository _patientRepo; // برای کارهای دیتابیس بیماران
    private readonly IGenericRepository<VitalSign> _vitalRepo; // برای علائم حیاتی

    public PatientsController(IPatientRepository patientRepo, IGenericRepository<VitalSign> vitalRepo)
    {
        _patientRepo = patientRepo;
        _vitalRepo = vitalRepo;
    }

    // ─── GET /api/patients ─────────────────────────────────────
    // لیست بیماران با امکان جستجو و صفحه‌بندی
    // فقط دکتر و منشی می‌تونن لیست همه بیماران رو ببینن
    // پارامترها: search (جستجو)، page (شماره صفحه)، pageSize (تعداد در هر صفحه)
    [HttpGet]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var (items, total) = await _patientRepo.GetPagedAsync(search, page, pageSize, ct);

        // نتیجه رو به شکل صفحه‌بندی شده برگردون
        return Ok(new
        {
            items = items.Select(MapToDto),   // لیست بیماران این صفحه
            total,                             // کل تعداد بیماران
            page,                              // شماره صفحه فعلی
            pageSize,                          // تعداد در هر صفحه
            totalPages = (int)Math.Ceiling((double)total / pageSize) // تعداد کل صفحات
        });
    }

    // ─── GET /api/patients/{id} ────────────────────────────────
    // پرونده کامل یه بیمار خاص
    // بیماران فقط پرونده خودشون رو می‌تونن ببینن (نه پرونده بقیه)
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        // همه اطلاعات بیمار رو با جزئیات کامل بگیر (نوبت‌ها، نسخه‌ها، پرونده‌ها)
        var patient = await _patientRepo.GetWithFullDetailsAsync(id, ct);
        if (patient == null) return NotFound();

        // اگه کاربر بیمار بود، فقط پرونده خودش رو ببینه
        var role = User.FindFirstValue("role");
        if (role == nameof(UserRole.Patient))
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            // اگه ID کاربر با ID صاحب پرونده مطابقت نداشت، دسترسی ممنوع!
            if (patient.UserId != userId) return Forbid(); // HTTP 403
        }

        return Ok(MapToDetailDto(patient));
    }

    // ─── GET /api/patients/me ──────────────────────────────────
    // بیمار می‌تونه با این آدرس پرونده خودش رو ببینه
    // بدون نیاز به دانستن ID خودش
    [HttpGet("me")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> GetMyProfile(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var patient = await _patientRepo.GetByUserIdAsync(userId, ct);
        if (patient == null) return NotFound();
        // پرونده کامل رو بگیر
        var full = await _patientRepo.GetWithFullDetailsAsync(patient.Id, ct);
        return Ok(MapToDetailDto(full!));
    }

    // ─── PUT /api/patients/{id} ────────────────────────────────
    // ویرایش اطلاعات بیمار
    // فقط فیلدهایی که فرستاده شدن تغییر می‌کنن (null = بدون تغییر)
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePatientDto dto, CancellationToken ct)
    {
        var patient = await _patientRepo.GetByIdAsync(id, ct);
        if (patient == null) return NotFound();
        if (!CanAccessPatient(patient)) return Forbid();

        // هر فیلدی که null نبود رو آپدیت کن
        if (dto.Address != null) patient.Address = dto.Address;
        if (dto.EmergencyContactName != null) patient.EmergencyContactName = dto.EmergencyContactName;
        if (dto.EmergencyContactPhone != null) patient.EmergencyContactPhone = dto.EmergencyContactPhone;
        if (dto.BloodType != null) patient.BloodType = dto.BloodType;
        if (dto.Allergies != null) patient.Allergies = dto.Allergies;
        if (dto.ChronicDiseases != null) patient.ChronicDiseases = dto.ChronicDiseases;
        if (dto.CurrentMedications != null) patient.CurrentMedications = dto.CurrentMedications;
        if (dto.FamilyHistory != null) patient.FamilyHistory = dto.FamilyHistory;
        if (dto.InsuranceCode != null) patient.InsuranceCode = dto.InsuranceCode;
        if (dto.InsuranceProvider != null) patient.InsuranceProvider = dto.InsuranceProvider;

        patient.SetUpdated(); // تاریخ آخرین ویرایش رو به‌روز کن

        _patientRepo.Update(patient);
        await _patientRepo.SaveChangesAsync(ct);
        return Ok(MapToDto(patient));
    }

    // ─── GET /api/patients/{id}/vitals ────────────────────────
    // تاریخچه علائم حیاتی بیمار برای رسم نمودار
    // می‌شه فیلتر کرد: نوع (وزن/فشار/قند)، بازه تاریخ
    [HttpGet("{id:guid}/vitals")]
    public async Task<IActionResult> GetVitalTrends(
        Guid id, [FromQuery] VitalTrendType? type,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var patient = await _patientRepo.GetByIdAsync(id, ct);
        if (patient == null) return NotFound();
        if (!CanAccessPatient(patient)) return Forbid();

        // داده‌های علائم حیاتی رو با فیلترهای خواسته شده بگیر
        var vitals = await _vitalRepo.FindAsync(
            v => v.PatientId == id &&
                 (!type.HasValue || v.Type == type) &&         // اگه نوع داده شد فیلتر کن
                 (!from.HasValue || v.RecordedAt >= from) &&   // از این تاریخ
                 (!to.HasValue || v.RecordedAt <= to), ct);    // تا این تاریخ

        // داده‌ها رو بر اساس نوع گروه‌بندی کن (یه گروه برای وزن، یه گروه برای فشار و...)
        var grouped = vitals
            .GroupBy(v => v.Type)
            .Select(g => new VitalTrendDto
            {
                Type = g.Key,
                Label = GetVitalLabel(g.Key),    // اسم فارسی (مثلاً: "فشار خون")
                Unit = GetVitalUnit(g.Key),      // واحد (مثلاً: "mmHg")
                // نقاط داده برای رسم نمودار (مرتب بر اساس زمان)
                DataPoints = g.OrderBy(v => v.RecordedAt)
                    .Select(v => new VitalDataPointDto
                    {
                        Date = v.RecordedAt,
                        Value = v.Value,
                        Notes = v.Notes
                    }).ToList(),
                Min = g.Min(v => v.Value),                                      // کمترین مقدار
                Max = g.Max(v => v.Value),                                      // بیشترین مقدار
                Average = Math.Round(g.Average(v => v.Value), 1),              // میانگین
                TrendDirection = CalculateTrend(g.OrderBy(v => v.RecordedAt).Select(v => v.Value).ToList()) // روند: بالا/پایین/ثابت
            });

        return Ok(grouped);
    }

    // ─── POST /api/patients/{id}/vitals ───────────────────────
    // ثبت یه اندازه‌گیری جدید برای بیمار (دستی، خارج از ویزیت)
    // فقط دکتر و منشی می‌تونن ثبت کنن
    [HttpPost("{id:guid}/vitals")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> AddVital(Guid id, [FromBody] AddVitalDto dto, CancellationToken ct)
    {
        if (!await _patientRepo.AnyAsync(p => p.Id == id, ct)) return NotFound();

        var vital = new VitalSign
        {
            PatientId = id,
            Type = dto.Type,
            Value = dto.Value,
            Unit = GetVitalUnit(dto.Type),    // واحد رو خودکار تعیین کن
            Notes = dto.Notes,
            RecordedAt = dto.RecordedAt ?? DateTime.UtcNow, // اگه تاریخ ندادن، الان
            RecordedByUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!) // کی ثبت کرد
        };
        await _vitalRepo.AddAsync(vital, ct);
        await _vitalRepo.SaveChangesAsync(ct);
        return Ok(vital);
    }

    private bool CanAccessPatient(Patient patient)
    {
        if (User.IsInRole(nameof(UserRole.SuperAdmin)) || User.IsInRole(nameof(UserRole.Admin)))
            return true;

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out var userId) && patient.UserId == userId;
    }

    // ═══ متدهای کمکی (Helper Methods) ═══════════════════════════

    // محاسبه جهت روند تغییرات
    // اگه نیمه دوم داده‌ها بیشتر از ۵٪ از نیمه اول بیشتر بود: "up" (بالا)
    // اگه کمتر بود: "down" (پایین)
    // وگرنه: "stable" (ثابت)
    private static string CalculateTrend(List<decimal> values)
    {
        if (values.Count < 2) return "stable"; // با یه نقطه نمیشه روند تشخیص داد
        var first = values.Take(values.Count / 2).Average();  // میانگین نیمه اول
        var last = values.Skip(values.Count / 2).Average();   // میانگین نیمه دوم
        if (last > first * 1.05m) return "up";    // بیشتر از ۵٪ افزایش
        if (last < first * 0.95m) return "down";  // بیشتر از ۵٪ کاهش
        return "stable";
    }

    // اسم فارسی هر نوع اندازه‌گیری
    private static string GetVitalLabel(VitalTrendType type) => type switch
    {
        VitalTrendType.Weight => "وزن",
        VitalTrendType.BloodPressureSystolic => "فشار خون سیستولیک",
        VitalTrendType.BloodPressureDiastolic => "فشار خون دیاستولیک",
        VitalTrendType.BloodSugar => "قند خون",
        VitalTrendType.HeartRate => "ضربان قلب",
        VitalTrendType.Temperature => "دما",
        VitalTrendType.OxygenSaturation => "اشباع اکسیژن",
        VitalTrendType.BMI => "BMI",
        _ => type.ToString()
    };

    // واحد اندازه‌گیری هر نوع
    private static string? GetVitalUnit(VitalTrendType type) => type switch
    {
        VitalTrendType.Weight => "kg",                                                      // کیلوگرم
        VitalTrendType.BloodPressureSystolic or VitalTrendType.BloodPressureDiastolic => "mmHg", // میلی‌متر جیوه
        VitalTrendType.BloodSugar => "mg/dL",                                              // میلی‌گرم در دسی‌لیتر
        VitalTrendType.HeartRate => "bpm",                                                  // ضربان در دقیقه
        VitalTrendType.Temperature => "°C",                                                 // سانتیگراد
        VitalTrendType.OxygenSaturation => "%",                                            // درصد
        VitalTrendType.BMI => "kg/m²",                                                     // کیلوگرم بر متر مربع
        _ => null
    };

    // تبدیل آبجکت Patient به DTO خلاصه (برای لیست)
    private static PatientDto MapToDto(Patient p) => new()
    {
        Id = p.Id,
        UserId = p.UserId,
        FullName = p.User?.FullName ?? string.Empty,
        PhoneNumber = p.User?.PhoneNumber ?? string.Empty,
        NationalCode = p.NationalCode,
        DateOfBirth = p.DateOfBirth,
        Age = p.Age,
        Gender = p.Gender,
        BloodType = p.BloodType,
        Address = p.Address,
        InsuranceProvider = p.InsuranceProvider,
        InsuranceCode = p.InsuranceCode,
        // تعداد ویزیت‌های انجام شده
        TotalVisits = p.Appointments?.Count(a => a.Status == AppointmentStatus.Completed) ?? 0,
        // آخرین ویزیت
        LastVisitDate = p.Appointments?.Where(a => a.Status == AppointmentStatus.Completed)
            .OrderByDescending(a => a.AppointmentDate).FirstOrDefault()?.AppointmentDate
    };

    // تبدیل به DTO کامل (برای صفحه جزئیات بیمار)
    private static PatientDetailDto MapToDetailDto(Patient p) => new()
    {
        Id = p.Id,
        UserId = p.UserId,
        FullName = p.User?.FullName ?? string.Empty,
        PhoneNumber = p.User?.PhoneNumber ?? string.Empty,
        NationalCode = p.NationalCode,
        DateOfBirth = p.DateOfBirth,
        Age = p.Age,
        Gender = p.Gender,
        BloodType = p.BloodType,
        Address = p.Address,
        InsuranceProvider = p.InsuranceProvider,
        InsuranceCode = p.InsuranceCode,
        Allergies = p.Allergies,
        ChronicDiseases = p.ChronicDiseases,
        CurrentMedications = p.CurrentMedications,
        FamilyHistory = p.FamilyHistory,
        EmergencyContactName = p.EmergencyContactName,
        EmergencyContactPhone = p.EmergencyContactPhone,
        TotalVisits = p.Appointments?.Count(a => a.Status == AppointmentStatus.Completed) ?? 0,
        LastVisitDate = p.Appointments?.Where(a => a.Status == AppointmentStatus.Completed)
            .OrderByDescending(a => a.AppointmentDate).FirstOrDefault()?.AppointmentDate,
        // آخرین مقدار هر نوع علامت حیاتی (برای نمایش در کارت خلاصه)
        RecentVitals = p.VitalSigns?
            .GroupBy(v => v.Type)
            .Select(g => g.OrderByDescending(v => v.RecordedAt).First()) // آخرین اندازه‌گیری هر نوع
            .Select(v => new VitalSignSummaryDto { Type = v.Type, Value = v.Value, Unit = v.Unit, RecordedAt = v.RecordedAt })
            .ToList() ?? new()
    };
}

// DTO برای ثبت علامت حیاتی جدید
// record = نوع داده فقط‌خواندنی - مثل struct ولی بهتر
public record AddVitalDto(VitalTrendType Type, decimal Value, string? Notes, DateTime? RecordedAt);
