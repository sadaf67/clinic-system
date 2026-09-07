// ══════════════════════════════════════════════════════════════
// MedicalRecordsController — کنترلر پرونده‌های پزشکی
//
// این کنترلر مسئول ثبت و خوندن ویزیت‌های بیماره.
// هر بار که دکتر بیمار رو ویزیت می‌کنه، یه MedicalRecord میسازه
// که شامل: تشخیص، دستور درمان، علائم حیاتی و...
//
// کار اضافی مهم: وقتی Record میسازه، علائم حیاتی (وزن، فشار،
// قند...) رو به صورت جداگانه هم ذخیره می‌کنه تا بعداً
// نمودار روند (Trend) رسم بشه
//
// دسترسی: همه لاگین‌شده‌ها GET دارن، فقط دکتر/منشی POST/PUT دارن
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // همه لاگین‌شده‌ها می‌تونن بخونن
public class MedicalRecordsController : ControllerBase
{
    // ریپازیتوری پرونده پزشکی
    private readonly IGenericRepository<MedicalRecord> _repo;

    // ریپازیتوری علائم حیاتی — برای ذخیره جداگانه هر علامت (برای نمودار)
    private readonly IGenericRepository<VitalSign> _vitalRepo;

    // ریپازیتوری بیماران
    private readonly IPatientRepository _patientRepo;
    private readonly IGenericRepository<MedicalRecordVersion> _versionRepo;

    public MedicalRecordsController(
        IGenericRepository<MedicalRecord> repo,
        IGenericRepository<VitalSign> vitalRepo,
        IPatientRepository patientRepo,
        IGenericRepository<MedicalRecordVersion> versionRepo)
    {
        _repo = repo;
        _vitalRepo = vitalRepo;
        _patientRepo = patientRepo;
        _versionRepo = versionRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // GetByPatient: گرفتن همه پرونده‌های یه بیمار مشخص
    // آدرس: GET /api/medicalrecords?patientId=xxx
    // جدیدترین ویزیت اول نشون داده میشه
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

        var records = patientId.HasValue
            ? await _repo.FindAsync(r => r.PatientId == patientId.Value, ct)
            : await _repo.GetAllAsync(ct);
        var names = await _patientRepo.GetNamesByIdsAsync(records.Select(r => r.PatientId), ct);

        return Ok(records
            .OrderByDescending(r => r.VisitDate)
            .Select(r => MapToDto(r, names.GetValueOrDefault(r.PatientId, string.Empty))));
    }

    // ──────────────────────────────────────────────────────────────
    // GetById: گرفتن جزئیات یه پرونده مشخص (با id)
    // آدرس: GET /api/medicalrecords/{id}
    // جزئیات بیشتری برمیگردونه (TreatmentPlan، DoctorNotes، Files)
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var record = await _repo.GetByIdAsync(id, ct);
        if (record == null) return NotFound(); // ۴۰۴ اگه پیدا نشد
        if (!await CanAccessPatientAsync(record.PatientId, ct)) return Forbid();
        return Ok(MapToDetailDto(record));
    }

    // ──────────────────────────────────────────────────────────────
    // Create: ثبت ویزیت جدید
    // آدرس: POST /api/medicalrecords
    // فقط دکتر/منشی می‌تونن ویزیت جدید ثبت کنن
    //
    // کار خاص: بعد از ثبت Record، علائم حیاتی رو هم جداگانه
    // توی جدول VitalSigns ذخیره می‌کنه تا نمودار روند رسم بشه
    // ──────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateMedicalRecordDto dto, CancellationToken ct)
    {
        if (!await _patientRepo.AnyAsync(p => p.Id == dto.PatientId, ct))
            return NotFound(new { message = "Patient not found." });

        // شناسه دکتر رو از توکن JWT می‌خونه
        var doctorId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // ساختن موجودیت MedicalRecord از DTO دریافتی
        var record = new MedicalRecord
        {
            PatientId             = dto.PatientId,
            AppointmentId         = dto.AppointmentId,
            DoctorId              = doctorId,
            VisitDate             = dto.VisitDate ?? DateTime.UtcNow, // اگه تاریخ داده نشد، الان
            ChiefComplaint        = dto.ChiefComplaint,   // علت مراجعه
            Diagnosis             = dto.Diagnosis,          // تشخیص
            DiagnosisCode         = dto.DiagnosisCode,      // کد ICD تشخیص
            TreatmentPlan         = dto.TreatmentPlan,      // برنامه درمانی
            DoctorNotes           = dto.DoctorNotes,        // یادداشت دکتر
            FollowUpInstructions  = dto.FollowUpInstructions, // دستورات پیگیری
            NextVisitDate         = dto.NextVisitDate,      // تاریخ ویزیت بعدی
            // علائم حیاتی
            Weight                = dto.Weight,
            Height                = dto.Height,
            BloodPressureSystolic = dto.BloodPressureSystolic,
            BloodPressureDiastolic= dto.BloodPressureDiastolic,
            Temperature           = dto.Temperature,
            HeartRate             = dto.HeartRate,
            OxygenSaturation      = dto.OxygenSaturation,
            BloodSugar            = dto.BloodSugar,
        };

        await _repo.AddAsync(record, ct);
        await _versionRepo.AddAsync(CreateVersion(record, doctorId, 1, "Initial version"), ct);

        // ── ذخیره جداگانه علائم حیاتی برای نمودار روند ─────────
        // هر علامتی که داده شده رو به جدول VitalSigns اضافه می‌کنه
        // .HasValue = چک می‌کنه که مقدار null نباشه
        var vitalEntries = new List<VitalSign>();
        if (dto.Weight.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.Weight, dto.Weight.Value));
        if (dto.BloodPressureSystolic.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.BloodPressureSystolic, dto.BloodPressureSystolic.Value));
        if (dto.BloodPressureDiastolic.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.BloodPressureDiastolic, dto.BloodPressureDiastolic.Value));
        if (dto.BloodSugar.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.BloodSugar, (decimal)dto.BloodSugar.Value));
        if (dto.HeartRate.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.HeartRate, dto.HeartRate.Value));
        if (dto.Temperature.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.Temperature, dto.Temperature.Value));
        if (dto.OxygenSaturation.HasValue)
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.OxygenSaturation, dto.OxygenSaturation.Value));

        // ── محاسبه و ذخیره BMI ───────────────────────────────────
        // فرمول BMI: وزن (kg) تقسیم بر مجذور قد (m)
        // مثال: وزن ۷۰ کیلو، قد ۱۷۵ سانتی → BMI = 70 / (1.75)² = 22.9
        if (dto.Weight.HasValue && dto.Height.HasValue && dto.Height > 0)
        {
            var bmi = dto.Weight.Value / (decimal)Math.Pow((double)(dto.Height.Value / 100), 2);
            vitalEntries.Add(CreateVital(dto.PatientId, doctorId, Domain.Enums.VitalTrendType.BMI, Math.Round(bmi, 1)));
        }

        // ذخیره همه VitalSigns توی دیتابیس
        foreach (var v in vitalEntries)
            await _vitalRepo.AddAsync(v, ct);

        await _repo.SaveChangesAsync(ct); // ذخیره همه چیز
        return CreatedAtAction(nameof(GetById), new { id = record.Id }, MapToDetailDto(record));
        // ↑ کد ۲۰۱ Created برمیگردونه + آدرس پرونده جدید
    }

    // ──────────────────────────────────────────────────────────────
    // Update: ویرایش پرونده موجود
    // آدرس: PUT /api/medicalrecords/{id}
    // فقط دکتر/منشی می‌تونن ویرایش کنن
    // ──────────────────────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMedicalRecordDto dto, CancellationToken ct)
    {
        var record = await _repo.GetByIdAsync(id, ct);
        if (record == null) return NotFound();

        // فقط فیلدهایی رو که داده شدن آپدیت می‌کنه (null نیستن)
        if (dto.Diagnosis != null)            record.Diagnosis = dto.Diagnosis;
        if (dto.DiagnosisCode != null)        record.DiagnosisCode = dto.DiagnosisCode;
        if (dto.TreatmentPlan != null)        record.TreatmentPlan = dto.TreatmentPlan;
        if (dto.DoctorNotes != null)          record.DoctorNotes = dto.DoctorNotes;
        if (dto.FollowUpInstructions != null) record.FollowUpInstructions = dto.FollowUpInstructions;
        if (dto.NextVisitDate.HasValue)       record.NextVisitDate = dto.NextVisitDate;

        record.SetUpdated(); // زمان آخرین ویرایش رو بروز می‌کنه

        var versions = await _versionRepo.FindAsync(v => v.MedicalRecordId == id, ct);
        await _versionRepo.AddAsync(CreateVersion(
            record, Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
            versions.Select(v => v.VersionNumber).DefaultIfEmpty(0).Max() + 1,
            dto.ChangeReason), ct);

        _repo.Update(record);
        await _repo.SaveChangesAsync(ct);
        return Ok(MapToDetailDto(record));
    }

    [HttpGet("{id:guid}/versions")]
    public async Task<IActionResult> GetVersions(Guid id, CancellationToken ct)
    {
        var record = await _repo.GetByIdAsync(id, ct);
        if (record == null) return NotFound();
        if (!await CanAccessPatientAsync(record.PatientId, ct)) return Forbid();
        var versions = await _versionRepo.FindAsync(v => v.MedicalRecordId == id, ct);
        return Ok(versions.OrderByDescending(v => v.VersionNumber).Select(v => new
        {
            v.Id, v.VersionNumber, v.ChangedByUserId, v.ChangedAt, v.ChangeReason
        }));
    }

    [HttpPost("{id:guid}/versions/{versionNumber:int}/restore")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> RestoreVersion(Guid id, int versionNumber, [FromBody] RestoreVersionRequest request, CancellationToken ct)
    {
        var record = await _repo.GetByIdAsync(id, ct);
        if (record == null) return NotFound();
        var versions = (await _versionRepo.FindAsync(v => v.MedicalRecordId == id, ct)).ToList();
        var source = versions.FirstOrDefault(v => v.VersionNumber == versionNumber);
        if (source == null) return NotFound();
        var snapshot = JsonSerializer.Deserialize<MedicalRecordSnapshot>(source.SnapshotJson);
        if (snapshot == null) return UnprocessableEntity(new { message = "Stored version is invalid." });
        ApplySnapshot(record, snapshot);
        record.SetUpdated();
        await _versionRepo.AddAsync(CreateVersion(
            record, Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
            versions.Select(v => v.VersionNumber).DefaultIfEmpty(0).Max() + 1,
            request.Reason ?? $"Restored from version {versionNumber}"), ct);
        _repo.Update(record);
        await _repo.SaveChangesAsync(ct);
        return Ok(MapToDetailDto(record));
    }

    private async Task<bool> CanAccessPatientAsync(Guid patientId, CancellationToken ct)
    {
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out var userId) &&
               await _patientRepo.AnyAsync(p => p.Id == patientId && p.UserId == userId, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // CreateVital: متد کمکی — ساختن یه موجودیت VitalSign
    // هر بار که یه علامت حیاتی می‌خوایم ذخیره کنیم ازش استفاده می‌کنیم
    // ──────────────────────────────────────────────────────────────
    private static VitalSign CreateVital(Guid patientId, Guid doctorId, Domain.Enums.VitalTrendType type, decimal value) => new()
    {
        PatientId        = patientId,
        RecordedByUserId = doctorId,
        Type             = type,
        Value            = value,
        RecordedAt       = DateTime.UtcNow
    };

    private static MedicalRecordVersion CreateVersion(
        MedicalRecord record, Guid userId, int versionNumber, string? reason) => new()
    {
        MedicalRecordId = record.Id,
        VersionNumber = versionNumber,
        ChangedByUserId = userId,
        ChangedAt = DateTime.UtcNow,
        SnapshotJson = JsonSerializer.Serialize(ToSnapshot(record)),
        ChangeReason = string.IsNullOrWhiteSpace(reason) ? "Updated" : reason.Trim()
    };

    private static MedicalRecordSnapshot ToSnapshot(MedicalRecord r) => new(
        r.Diagnosis, r.DiagnosisCode, r.TreatmentPlan, r.DoctorNotes, r.FollowUpInstructions,
        r.NextVisitDate, r.Weight, r.Height, r.BloodPressureSystolic, r.BloodPressureDiastolic,
        r.Temperature, r.HeartRate, r.OxygenSaturation, r.BloodSugar);

    private static void ApplySnapshot(MedicalRecord r, MedicalRecordSnapshot s)
    {
        r.Diagnosis = s.Diagnosis; r.DiagnosisCode = s.DiagnosisCode;
        r.TreatmentPlan = s.TreatmentPlan; r.DoctorNotes = s.DoctorNotes;
        r.FollowUpInstructions = s.FollowUpInstructions; r.NextVisitDate = s.NextVisitDate;
        r.Weight = s.Weight; r.Height = s.Height;
        r.BloodPressureSystolic = s.BloodPressureSystolic;
        r.BloodPressureDiastolic = s.BloodPressureDiastolic;
        r.Temperature = s.Temperature; r.HeartRate = s.HeartRate;
        r.OxygenSaturation = s.OxygenSaturation; r.BloodSugar = s.BloodSugar;
    }

    // ──────────────────────────────────────────────────────────────
    // MapToDto: تبدیل MedicalRecord به آبجکت کوچیک (برای لیست‌ها)
    // ──────────────────────────────────────────────────────────────
    private static object MapToDto(MedicalRecord r, string patientName = "") => new
    {
        r.Id, r.PatientId, r.DoctorId, r.VisitDate,
        PatientName = patientName,
        r.ChiefComplaint, r.Diagnosis, r.DiagnosisCode,
        r.TreatmentPlan,
        r.Weight, r.Height, r.BMI,
        r.BloodPressureSystolic, r.BloodPressureDiastolic,
        BP = r.BloodPressureSystolic.HasValue && r.BloodPressureDiastolic.HasValue
            ? $"{r.BloodPressureSystolic}/{r.BloodPressureDiastolic}"
            : null,
        r.HeartRate, r.Temperature, r.OxygenSaturation, r.BloodSugar,
        r.NextVisitDate, r.CreatedAt
    };

    // ──────────────────────────────────────────────────────────────
    // MapToDetailDto: تبدیل MedicalRecord به آبجکت کامل (برای صفحه جزئیات)
    // شامل: TreatmentPlan، DoctorNotes، Files
    // ──────────────────────────────────────────────────────────────
    private static object MapToDetailDto(MedicalRecord r) => new
    {
        r.Id, r.PatientId, r.DoctorId, r.AppointmentId, r.VisitDate,
        r.ChiefComplaint, r.Diagnosis, r.DiagnosisCode,
        r.TreatmentPlan, r.DoctorNotes, r.FollowUpInstructions,
        r.Weight, r.Height, r.BMI,
        r.BloodPressureSystolic, r.BloodPressureDiastolic,
        r.HeartRate, r.Temperature, r.OxygenSaturation, r.BloodSugar,
        r.NextVisitDate,
        // فایل‌های ضمیمه پرونده (آزمایش، رادیولوژی و...)
        Files = r.Files.Select(f => new { f.Id, f.FileName, f.FileUrl, f.FileType, f.Description }),
        r.CreatedAt
    };
}

// ──────────────────────────────────────────────────────────────
// CreateMedicalRecordDto: ساختار داده برای ثبت ویزیت جدید
// ? یعنی اختیاری — می‌تونه null باشه
// ──────────────────────────────────────────────────────────────
public class CreateMedicalRecordDto
{
    public Guid PatientId { get; set; }           // شناسه بیمار (اجباری)
    public Guid? AppointmentId { get; set; }       // شناسه نوبت (اختیاری)
    public DateTime? VisitDate { get; set; }       // تاریخ ویزیت (اختیاری — اگه ندی، الان میشه)
    public string? ChiefComplaint { get; set; }    // علت مراجعه
    public string? Diagnosis { get; set; }          // تشخیص
    public string? DiagnosisCode { get; set; }      // کد ICD-10 تشخیص
    public string? TreatmentPlan { get; set; }      // برنامه درمانی
    public string? DoctorNotes { get; set; }        // یادداشت خصوصی دکتر
    public string? FollowUpInstructions { get; set; } // دستورات برای بیمار
    public DateTime? NextVisitDate { get; set; }   // تاریخ ویزیت بعدی

    // علائم حیاتی — همه اختیاری
    public decimal? Weight { get; set; }             // وزن (kg)
    public decimal? Height { get; set; }             // قد (cm)
    public int? BloodPressureSystolic { get; set; }  // فشار سیستولیک (عدد بالا)
    public int? BloodPressureDiastolic { get; set; } // فشار دیاستولیک (عدد پایین)
    public decimal? Temperature { get; set; }        // دما (سانتیگراد)
    public int? HeartRate { get; set; }              // ضربان قلب (bpm)
    public int? OxygenSaturation { get; set; }       // اشباع اکسیژن (%)
    public decimal? BloodSugar { get; set; }         // قند خون (mg/dL)
}

// ──────────────────────────────────────────────────────────────
// UpdateMedicalRecordDto: ساختار داده برای ویرایش پرونده
// فقط فیلدهایی که دکتر می‌تونه بعداً ویرایش کنه
// ──────────────────────────────────────────────────────────────
public class UpdateMedicalRecordDto
{
    public string? Diagnosis { get; set; }
    public string? DiagnosisCode { get; set; }
    public string? TreatmentPlan { get; set; }
    public string? DoctorNotes { get; set; }
    public string? FollowUpInstructions { get; set; }
    public DateTime? NextVisitDate { get; set; }
    public string? ChangeReason { get; set; }
}

public sealed record RestoreVersionRequest(string? Reason);
public sealed record MedicalRecordSnapshot(
    string? Diagnosis, string? DiagnosisCode, string? TreatmentPlan, string? DoctorNotes,
    string? FollowUpInstructions, DateTime? NextVisitDate, decimal? Weight, decimal? Height,
    int? BloodPressureSystolic, int? BloodPressureDiastolic, decimal? Temperature,
    int? HeartRate, int? OxygenSaturation, decimal? BloodSugar);
