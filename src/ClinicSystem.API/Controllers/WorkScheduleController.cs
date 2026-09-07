// ══════════════════════════════════════════════════════════════
// WorkScheduleController — کنترلر برنامه کاری دکتر
//
// دکتر می‌تونه تعریف کنه که:
// - کدوم روزهای هفته کار می‌کنه
// - از چه ساعتی تا چه ساعتی
// - هر نوبت چند دقیقه‌ست
// - کدوم روزها تعطیله (ایام خاص یا مرخصی)
//
// وقتی بیمار نوبت می‌گیره، سیستم از این اطلاعات استفاده می‌کنه
// تا "ساعت‌های خالی" رو نشون بده
//
// دسترسی: فقط SuperAdmin (دکتر) و Admin (منشی)
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin,Admin")]
public class WorkScheduleController : ControllerBase
{
    private readonly IGenericRepository<WorkSchedule> _scheduleRepo; // ریپازیتوری برنامه هفتگی
    private readonly IGenericRepository<DayOff> _dayOffRepo;         // ریپازیتوری روزهای تعطیل

    public WorkScheduleController(
        IGenericRepository<WorkSchedule> scheduleRepo,
        IGenericRepository<DayOff> dayOffRepo)
    {
        _scheduleRepo = scheduleRepo;
        _dayOffRepo = dayOffRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // GetSchedule: گرفتن برنامه هفتگی یه دکتر
    // آدرس: GET /api/workschedule/{doctorId}
    //
    // فقط آیتم‌های IsActive = true نشون داده میشن
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{doctorId:guid}")]
    public async Task<IActionResult> GetSchedule(Guid doctorId, CancellationToken ct)
    {
        var schedules = await _scheduleRepo.FindAsync(
            s => s.DoctorId == doctorId && s.IsActive, ct);

        return Ok(schedules.OrderBy(s => s.DayOfWeek).Select(s => new
        {
            s.Id,
            s.DayOfWeek,              // روز هفته (0=یکشنبه، 6=شنبه)
            s.StartTime,              // ساعت شروع (مثلاً 08:00)
            s.EndTime,                // ساعت پایان (مثلاً 14:00)
            s.SlotDurationMinutes,    // مدت هر نوبت (مثلاً ۳۰ دقیقه)
            s.MaxPatientsPerSlot      // حداکثر بیمار در هر نوبت
        }));
    }

    // ──────────────────────────────────────────────────────────────
    // SetSchedule: تنظیم برنامه هفتگی جدید
    // آدرس: POST /api/workschedule/{doctorId}
    //
    // استراتژی: همه رکوردهای قبلی غیرفعال میشن، بعد رکوردهای جدید
    // ایجاد میشن. این روش ساده‌تره از پیدا کردن تفاوت‌ها.
    // ──────────────────────────────────────────────────────────────
    [HttpPost("{doctorId:guid}")]
    public async Task<IActionResult> SetSchedule(
        Guid doctorId,
        [FromBody] List<UpsertScheduleDto> dto,
        CancellationToken ct)
    {
        // ── مرحله ۱: غیرفعال کردن برنامه فعلی ─────────────────
        var existing = await _scheduleRepo.FindAsync(s => s.DoctorId == doctorId, ct);
        foreach (var s in existing)
        {
            s.IsActive = false; // غیرفعال — پاک نمیشه، فقط IsActive = false
            _scheduleRepo.Update(s);
        }

        // ── مرحله ۲: ایجاد برنامه جدید ──────────────────────────
        foreach (var item in dto)
        {
            await _scheduleRepo.AddAsync(new WorkSchedule
            {
                DoctorId           = doctorId,
                DayOfWeek          = item.DayOfWeek,
                StartTime          = item.StartTime,
                EndTime            = item.EndTime,
                SlotDurationMinutes= item.SlotDurationMinutes,
                MaxPatientsPerSlot = item.MaxPatientsPerSlot,
                IsActive           = true // فعال
            }, ct);
        }

        await _scheduleRepo.SaveChangesAsync(ct);
        return NoContent(); // ۲۰۴ — موفق
    }

    // ──────────────────────────────────────────────────────────────
    // GetDaysOff: گرفتن روزهای تعطیل دکتر
    // آدرس: GET /api/workschedule/{doctorId}/days-off
    //
    // پارامترهای اختیاری from و to برای فیلتر بازه زمانی
    // ──────────────────────────────────────────────────────────────
    [HttpGet("{doctorId:guid}/days-off")]
    public async Task<IActionResult> GetDaysOff(
        Guid doctorId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var daysOff = await _dayOffRepo.FindAsync(d =>
            d.DoctorId == doctorId &&
            (!from.HasValue || d.Date >= from.Value) &&
            (!to.HasValue   || d.Date <= to.Value), ct);

        return Ok(daysOff.OrderBy(d => d.Date).Select(d => new
        {
            d.Id,
            d.Date,
            d.Reason,   // دلیل تعطیلی (فارسی)
            d.ReasonEn  // دلیل تعطیلی (انگلیسی)
        }));
    }

    // ──────────────────────────────────────────────────────────────
    // AddDayOff: اضافه کردن روز تعطیل جدید
    // آدرس: POST /api/workschedule/{doctorId}/days-off
    //
    // چک می‌کنه روز تکراری نباشه
    // ──────────────────────────────────────────────────────────────
    [HttpPost("{doctorId:guid}/days-off")]
    public async Task<IActionResult> AddDayOff(
        Guid doctorId,
        [FromBody] AddDayOffDto dto,
        CancellationToken ct)
    {
        // چک کردن تکراری نبودن روز تعطیل
        var existing = await _dayOffRepo.AnyAsync(
            d => d.DoctorId == doctorId && d.Date.Date == dto.Date.Date, ct);
        if (existing)
            return Conflict(new { message = "این روز قبلاً به عنوان تعطیل ثبت شده." });

        await _dayOffRepo.AddAsync(new DayOff
        {
            DoctorId = doctorId,
            Date     = dto.Date,
            Reason   = dto.Reason,
            ReasonEn = dto.ReasonEn
        }, ct);
        await _dayOffRepo.SaveChangesAsync(ct);

        return NoContent();
    }

    // ──────────────────────────────────────────────────────────────
    // RemoveDayOff: حذف یه روز تعطیل
    // آدرس: DELETE /api/workschedule/days-off/{id}
    // ──────────────────────────────────────────────────────────────
    [HttpDelete("days-off/{id:guid}")]
    public async Task<IActionResult> RemoveDayOff(Guid id, CancellationToken ct)
    {
        var d = await _dayOffRepo.GetByIdAsync(id, ct);
        if (d == null) return NotFound();

        _dayOffRepo.Remove(d);
        await _dayOffRepo.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ── DTOهای ورودی ─────────────────────────────────────────────

// برای تنظیم یه روز کاری از هفته
public record UpsertScheduleDto(
    DayOfWeek DayOfWeek,             // روز هفته: 0=یکشنبه، 6=شنبه
    TimeSpan StartTime,               // ساعت شروع
    TimeSpan EndTime,                 // ساعت پایان
    int SlotDurationMinutes = 30,    // مدت نوبت (پیش‌فرض ۳۰ دقیقه)
    int MaxPatientsPerSlot  = 1      // حداکثر بیمار در یه نوبت (پیش‌فرض ۱)
);

// برای ثبت روز تعطیل
public record AddDayOffDto(
    DateTime Date,       // تاریخ تعطیلی
    string? Reason,      // دلیل (فارسی) — اختیاری
    string? ReasonEn     // دلیل (انگلیسی) — اختیاری
);
