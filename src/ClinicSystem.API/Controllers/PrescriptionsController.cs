// ══════════════════════════════════════════════════════════════
// PrescriptionsController — کنترلر نسخه‌های دارویی
//
// نسخه = لیست داروهایی که دکتر برای بیمار می‌نویسه
// هر نسخه یه کد یکتا داره (مثل: RX-20240615-A3F2)
// و شامل چند قلم دارو (PrescriptionItem) میشه.
//
// دسترسی:
// - دکتر/منشی: نسخه جدید بنویسن، نسخه رو لغو کنن
// - همه لاگین‌شده‌ها: لیست و جزئیات نسخه‌ها رو ببینن
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PrescriptionsController : ControllerBase
{
    private readonly IGenericRepository<Prescription> _repo;         // ریپازیتوری نسخه
    private readonly IGenericRepository<PrescriptionItem> _itemRepo; // ریپازیتوری اقلام دارویی
    private readonly IPatientRepository _patientRepo;

    public PrescriptionsController(
        IGenericRepository<Prescription> repo,
        IGenericRepository<PrescriptionItem> itemRepo,
        IPatientRepository patientRepo)
    {
        _repo = repo;
        _itemRepo = itemRepo;
        _patientRepo = patientRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // GetByPatient: گرفتن نسخه‌های یه بیمار مشخص
    // آدرس: GET /api/prescriptions?patientId=xxx
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetByPatient([FromQuery] Guid? patientId, CancellationToken ct)
    {
        if (!User.IsInRole("SuperAdmin") && !User.IsInRole("Admin"))
        {
            var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdValue, out var userId)) return Forbid();
            var currentPatient = await _patientRepo.GetByUserIdAsync(userId, ct);
            if (currentPatient == null) return Forbid();
            patientId = currentPatient.Id;
        }

        var prescriptions = (patientId.HasValue
            ? await _repo.FindAsync(p => p.PatientId == patientId.Value, ct)
            : await _repo.GetAllAsync(ct)).ToList();
        var names = await _patientRepo.GetNamesByIdsAsync(prescriptions.Select(p => p.PatientId), ct);
        var prescriptionIds = prescriptions.Select(p => p.Id).ToArray();
        var items = await _itemRepo.FindAsync(i => prescriptionIds.Contains(i.PrescriptionId), ct);
        var itemsByPrescription = items.ToLookup(i => i.PrescriptionId);

        return Ok(prescriptions
            .OrderByDescending(p => p.IssuedDate)
            .Select(p => MapToDto(
                p,
                names.GetValueOrDefault(p.PatientId, string.Empty),
                itemsByPrescription[p.Id])));
        // جدیدترین نسخه اول نشون داده میشه
    }

    // ──────────────────────────────────────────────────────────────
    // GetById: گرفتن جزئیات یه نسخه + لیست داروهاش
    // آدرس: GET /api/prescriptions/{id}
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var p = await _repo.GetByIdAsync(id, ct);
        if (p == null) return NotFound();
        if (!await CanAccessPatientAsync(p.PatientId, ct)) return Forbid();

        // اقلام دارویی این نسخه رو هم میگیره
        var items = await _itemRepo.FindAsync(i => i.PrescriptionId == id, ct);

        return Ok(new
        {
            prescription = MapToDto(p),
            items = items.Select(i => new
            {
                i.Id,
                i.MedicineName,   // نام دارو (فارسی)
                i.MedicineNameEn, // نام دارو (انگلیسی/لاتین)
                i.Dosage,         // دوز: مثلاً "۵۰۰mg"
                i.Frequency,      // دفعات: مثلاً "روزی ۳ بار"
                i.Duration,       // مدت: مثلاً "۷ روز"
                i.Instructions,   // نحوه مصرف: "با غذا بخورید"
                i.Quantity        // تعداد قرص/شیشه
            })
        });
    }

    // ──────────────────────────────────────────────────────────────
    // Create: نوشتن نسخه جدید
    // آدرس: POST /api/prescriptions
    // فقط دکتر/منشی می‌تونن نسخه بنویسن
    //
    // کد نسخه خودکار تولید میشه:
    // فرمت: RX-{تاریخ}-{6کاراکتر تصادفی}
    // مثال: RX-20240615-A3F2B7
    // ──────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Create([FromBody] CreatePrescriptionDto dto, CancellationToken ct)
    {
        if (!await _patientRepo.AnyAsync(p => p.Id == dto.PatientId, ct))
            return NotFound(new { message = "Patient not found." });

        var doctorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // تولید کد یکتا برای نسخه
        var code = $"RX-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var prescription = new Prescription
        {
            PatientId       = dto.PatientId,
            DoctorId        = doctorId,
            MedicalRecordId = dto.MedicalRecordId,   // نوبت مرتبط (اختیاری)
            IssuedDate      = DateTime.UtcNow,
            // تاریخ انقضا: ValidDays روز دیگه (پیش‌فرض ۳۰ روز)
            ExpiryDate      = DateTime.UtcNow.AddDays(dto.ValidDays ?? 30),
            Notes           = dto.Notes,
            PrescriptionCode= code,
            Status          = PrescriptionStatus.Active, // نسخه فعاله
        };

        // اضافه کردن داروها به نسخه
        foreach (var item in dto.Items)
        {
            prescription.Items.Add(new PrescriptionItem
            {
                MedicineName   = item.MedicineName,
                MedicineNameEn = item.MedicineNameEn ?? item.MedicineName, // اگه انگلیسی ندادن، همون فارسی
                Dosage         = item.Dosage,
                Frequency      = item.Frequency,
                Duration       = item.Duration,
                Instructions   = item.Instructions,
                Quantity       = item.Quantity
            });
        }

        await _repo.AddAsync(prescription, ct);
        await _repo.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = prescription.Id }, MapToDto(prescription));
    }

    // ──────────────────────────────────────────────────────────────
    // Cancel: لغو کردن یه نسخه
    // آدرس: PATCH /api/prescriptions/{id}/cancel
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/cancel")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var p = await _repo.GetByIdAsync(id, ct);
        if (p == null) return NotFound();

        p.Status = PrescriptionStatus.Cancelled; // وضعیت: لغو
        p.SetUpdated();
        _repo.Update(p);
        await _repo.SaveChangesAsync(ct);

        return Ok(MapToDto(p));
    }

    private async Task<bool> CanAccessPatientAsync(Guid patientId, CancellationToken ct)
    {
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out var userId) &&
               await _patientRepo.AnyAsync(p => p.Id == patientId && p.UserId == userId, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // MapToDto: تبدیل نسخه به آبجکت قابل ارسال
    // IsExpired: خودکار چک می‌کنه آیا تاریخ انقضا گذشته
    // ──────────────────────────────────────────────────────────────
    private static object MapToDto(
        Prescription p,
        string patientName = "",
        IEnumerable<PrescriptionItem>? prescriptionItems = null) => new
    {
        p.Id, p.PatientId, p.DoctorId, p.MedicalRecordId,
        PatientName = patientName,
        p.IssuedDate, p.ExpiryDate,
        p.Status,                                    // Active، Expired، Cancelled
        p.PrescriptionCode,                          // مثلاً RX-20240615-A3F2B7
        p.Notes,
        Items = (prescriptionItems ?? p.Items ?? Array.Empty<PrescriptionItem>()).Select(i => new
        {
            i.Id, i.MedicineName, i.MedicineNameEn, i.Dosage,
            i.Frequency, i.Duration, i.Instructions, i.Quantity
        }),
        ItemCount  = prescriptionItems?.Count() ?? p.Items?.Count ?? 0,
        IsExpired  = p.ExpiryDate < DateTime.UtcNow, // آیا منقضی شده؟ (بله/خیر خودکار)
        DoctorName = p.Doctor?.FullName ?? string.Empty // نام دکتر
    };
}

// ──────────────────────────────────────────────────────────────
// CreatePrescriptionDto: ساختار ورودی برای نوشتن نسخه جدید
// ──────────────────────────────────────────────────────────────
public class CreatePrescriptionDto
{
    public Guid PatientId { get; set; }         // بیمار
    public Guid? MedicalRecordId { get; set; }  // پرونده ویزیت مرتبط (اختیاری)
    public string? Notes { get; set; }           // یادداشت دکتر
    public int? ValidDays { get; set; }          // مدت اعتبار نسخه (روز)
    public List<PrescriptionItemDto> Items { get; set; } = new(); // لیست داروها
}

// ──────────────────────────────────────────────────────────────
// PrescriptionItemDto: ساختار ورودی برای یه قلم دارو
// ──────────────────────────────────────────────────────────────
public class PrescriptionItemDto
{
    public string MedicineName   { get; set; } = string.Empty; // نام دارو (فارسی)
    public string? MedicineNameEn { get; set; }                 // نام دارو (انگلیسی)
    public string Dosage         { get; set; } = string.Empty; // دوز: "۵۰۰mg"
    public string Frequency      { get; set; } = string.Empty; // دفعات: "روزی ۳ بار"
    public string Duration       { get; set; } = string.Empty; // مدت: "۷ روز"
    public string? Instructions  { get; set; }                  // نحوه مصرف
    public int Quantity          { get; set; } = 1;            // تعداد (پیش‌فرض ۱)
}
