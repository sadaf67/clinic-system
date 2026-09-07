// ══════════════════════════════════════════════════════════════
// ConsultationsController — کنترلر مشاوره آنلاین
//
// مشاوره آنلاین یعنی بیمار یه سؤال پزشکی می‌نویسه
// و دکتر جواب میده — مثل چت با دکتر.
//
// نقش‌ها و دسترسی‌ها:
// - بیمار: مشاوره جدید ثبت کنه، لیست مشاوره‌هاش رو ببینه
// - دکتر/منشی: همه مشاوره‌ها رو ببینه، جواب بده، وضعیت تغییر بده
//
// وضعیت‌های مشاوره:
//   Waiting    → منتظر جواب دکتر
//   InProgress → دکتر داره بررسی می‌کنه
//   Completed  → دکتر جواب داد
//   Cancelled  → لغو شده
// ══════════════════════════════════════════════════════════════

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
[Authorize] // همه لاگین‌شده‌ها می‌تونن بخونن
public class ConsultationsController : ControllerBase
{
    private readonly IGenericRepository<OnlineConsultation> _repo;      // ریپازیتوری مشاوره
    private readonly IGenericRepository<ConsultationMessage> _msgRepo;  // ریپازیتوری پیام‌های چت
    private readonly INotificationService _notifService;                 // سرویس ارسال نوتیفیکیشن
    private readonly IPatientRepository _patientRepo;

    public ConsultationsController(
        IGenericRepository<OnlineConsultation> repo,
        IGenericRepository<ConsultationMessage> msgRepo,
        INotificationService notifService,
        IPatientRepository patientRepo)
    {
        _repo = repo;
        _msgRepo = msgRepo;
        _notifService = notifService;
        _patientRepo = patientRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // GetAll: گرفتن لیست مشاوره‌ها
    // آدرس: GET /api/consultations
    //
    // رفتار هوشمند بر اساس نقش:
    // - دکتر/منشی: همه مشاوره‌های کلینیک رو میبینن
    // - بیمار: فقط مشاوره‌های خودش رو میبینه
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] ConsultationStatus? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // آیا کاربر لاگین‌شده دکتر یا منشی هست؟
        var isDoctor = User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

        var items = await _repo.FindAsync(c =>
            // بیمار فقط مشاوره‌های خودش رو میبینه — دکتر همه رو میبینه
            (!isDoctor ? c.Patient.UserId == userId : true) &&
            // اگه فیلتر وضعیت داده شده، فیلتر کن
            (!status.HasValue || c.Status == status), ct);

        var total = items.Count();
        var paged = items.OrderByDescending(c => c.RequestedAt) // جدیدترین اول
            .Skip((page - 1) * pageSize).Take(pageSize);

        return Ok(new { items = paged.Select(MapToDto), total, page, pageSize });
    }

    // ──────────────────────────────────────────────────────────────
    // GetById: گرفتن جزئیات یه مشاوره + پیام‌های چتش
    // آدرس: GET /api/consultations/{id}
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null) return NotFound();
        if (!await CanAccessConsultationAsync(c, ct)) return Forbid();

        // پیام‌های چت این مشاوره رو هم میگیره (به ترتیب زمانی)
        var msgs = await _msgRepo.FindAsync(m => m.ConsultationId == id, ct);

        return Ok(new
        {
            consultation = MapToDto(c),
            messages = msgs.OrderBy(m => m.SentAt).Select(m => new
            {
                m.Id, m.SenderId, m.SenderName,
                m.IsDoctor,  // true = پیام از دکتر، false = از بیمار
                m.Content, m.IsRead, m.SentAt
            })
        });
    }

    // ──────────────────────────────────────────────────────────────
    // Create: ثبت مشاوره جدید
    // آدرس: POST /api/consultations
    // فقط بیمار می‌تونه مشاوره جدید ثبت کنه
    // ──────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> Create([FromBody] CreateConsultationDto dto, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var patient = await _patientRepo.GetByUserIdAsync(userId, ct);
        if (patient == null) return Forbid();

        // ساختن مشاوره جدید — وضعیت اولیه: Waiting
        var consultation = new OnlineConsultation
        {
            PatientId       = patient.Id,
            DoctorId        = dto.DoctorId,
            PatientQuestion = dto.Question,    // سؤال بیمار
            IsUrgent        = dto.IsUrgent,    // آیا اورژانسیه؟
            RequestedAt     = DateTime.UtcNow,
            Status          = ConsultationStatus.Waiting // منتظر جواب دکتر
        };

        await _repo.AddAsync(consultation, ct);
        await _repo.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = consultation.Id }, MapToDto(consultation));
    }

    // ──────────────────────────────────────────────────────────────
    // Answer: دکتر جواب مشاوره رو ثبت می‌کنه
    // آدرس: PATCH /api/consultations/{id}/answer
    // فقط دکتر/منشی می‌تونن جواب بدن
    //
    // بعد از ثبت جواب:
    // - وضعیت مشاوره میشه Completed
    // - یه نوتیفیکیشن به بیمار ارسال میشه
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/answer")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Answer(Guid id, [FromBody] AnswerConsultationDto dto, CancellationToken ct)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null) return NotFound();

        c.DoctorAnswer = dto.Answer;          // جواب دکتر
        c.AnsweredAt   = DateTime.UtcNow;     // زمان جواب
        c.Status       = ConsultationStatus.Completed; // وضعیت: جواب داده شد
        c.SetUpdated();

        _repo.Update(c);
        await _repo.SaveChangesAsync(ct);

        // ارسال نوتیفیکیشن به بیمار: "جواب مشاوره شما آماده‌ست"
        c.Patient = await _patientRepo.GetWithFullDetailsAsync(c.PatientId, ct) ?? c.Patient;
        await _notifService.SendConsultationReplyAsync(c, ct);

        return Ok(MapToDto(c));
    }

    private async Task<bool> CanAccessConsultationAsync(OnlineConsultation consultation, CancellationToken ct)
    {
        if (User.IsInRole("SuperAdmin") || User.IsInRole("Admin")) return true;

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out var userId) &&
               await _patientRepo.AnyAsync(
                   p => p.Id == consultation.PatientId && p.UserId == userId, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // UpdateStatus: تغییر دستی وضعیت مشاوره
    // آدرس: PATCH /api/consultations/{id}/status
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateConsultationStatusDto dto, CancellationToken ct)
    {
        var c = await _repo.GetByIdAsync(id, ct);
        if (c == null) return NotFound();

        c.Status = dto.Status;
        c.SetUpdated();
        _repo.Update(c);
        await _repo.SaveChangesAsync(ct);

        return Ok(MapToDto(c));
    }

    // ──────────────────────────────────────────────────────────────
    // MapToDto: تبدیل OnlineConsultation به آبجکت قابل ارسال
    // ──────────────────────────────────────────────────────────────
    private static object MapToDto(OnlineConsultation c) => new
    {
        c.Id,
        c.PatientId,
        PatientName    = c.Patient?.User?.FullName ?? string.Empty, // نام بیمار
        c.DoctorId,
        DoctorName     = c.Doctor?.FullName ?? string.Empty,        // نام دکتر
        c.Status,
        c.PatientQuestion, // سؤال بیمار
        c.DoctorAnswer,    // جواب دکتر (null اگه هنوز جواب نداده)
        c.IsUrgent,        // آیا اورژانسی هست؟
        c.Fee,             // هزینه مشاوره
        c.IsPaid,          // آیا پرداخت شده؟
        c.RequestedAt,     // زمان ثبت سؤال
        c.AnsweredAt,      // زمان جواب دکتر
        UnreadCount = 0    // تعداد پیام‌های خوانده‌نشده (برای badge)
    };
}

// ── DTOهای ورودی ─────────────────────────────────────────────
// record = یه کلاس خلاصه در C# (فقط خوندن، بدون setter)

// برای ثبت مشاوره جدید توسط بیمار
public record CreateConsultationDto(Guid DoctorId, string Question, bool IsUrgent = false);

// برای ثبت جواب توسط دکتر
public record AnswerConsultationDto(string Answer);

// برای تغییر دستی وضعیت مشاوره
public record UpdateConsultationStatusDto(ConsultationStatus Status);
