// ══════════════════════════════════════════════════════════════
// AppointmentsController = کنترلر نوبت‌ها
// همه عملیات روی نوبت‌های پزشکی از اینجا انجام میشه:
// - لیست نوبت‌ها (با فیلتر و صفحه‌بندی)
// - گرفتن یه نوبت خاص
// - نوبت‌های امروز
// - اسلات‌های خالی موجود
// - ثبت نوبت جدید
// - ویرایش نوبت
// - تغییر وضعیت (تأیید، لغو، انجام شد)
// - حذف نوبت
//
// آدرس‌های این کنترلر: /api/appointments/...
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.DTOs.Appointment;
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
[Authorize] // همه endpoint های این کنترلر نیاز به لاگین دارن
public class AppointmentsController : ControllerBase
{
    // سرویس نوبت‌ها - منطق اصلی اونجاست
    private readonly IAppointmentService _service;
    private readonly IPatientRepository _patientRepo;

    public AppointmentsController(IAppointmentService service, IPatientRepository patientRepo)
    {
        _service = service;
        _patientRepo = patientRepo;
    }

    // ─── GET /api/appointments ─────────────────────────────────
    // لیست نوبت‌ها با فیلتر و صفحه‌بندی
    // می‌شه فیلتر کرد: بر اساس دکتر، بیمار، وضعیت، بازه تاریخ
    // بیماران فقط نوبت‌های خودشون رو می‌بینن
    [HttpGet]
    public async Task<ActionResult<PagedResult<AppointmentDto>>> GetPaged(
        [FromQuery] AppointmentFilterDto filter, CancellationToken ct)
    {
        if (User.IsInRole(nameof(UserRole.Patient)))
        {
            var patient = await GetCurrentPatientAsync(ct);
            if (patient == null) return Forbid();
            filter.PatientId = patient.Id;
        }

        filter.Page = Math.Max(1, filter.Page);
        filter.PageSize = Math.Clamp(filter.PageSize, 1, 100);
        return Ok(await _service.GetPagedAsync(filter, ct));
    }

    // ─── GET /api/appointments/{id} ────────────────────────────
    // گرفتن اطلاعات یه نوبت خاص با ID آن
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var appointment = await _service.GetByIdAsync(id, ct);
            if (!await CanAccessPatientAsync(appointment.PatientId, ct)) return Forbid();
            return Ok(appointment);
        }
        catch (KeyNotFoundException) { return NotFound(); } // HTTP 404 اگه پیدا نشد
    }

    // ─── GET /api/appointments/today?doctorId=... ──────────────
    // نوبت‌های امروز یه دکتر خاص - برای نمایش در داشبورد
    // فقط دکتر و منشی می‌تونن ببینن
    [HttpGet("today")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<ActionResult<IEnumerable<AppointmentDto>>> GetToday(
        [FromQuery] Guid doctorId, CancellationToken ct)
        => Ok(await _service.GetTodayAppointmentsAsync(doctorId, ct));

    // ─── GET /api/appointments/available-slots ─────────────────
    // اسلات‌های زمانی خالی یه دکتر در یه روز مشخص
    // بیمار موقع گرفتن نوبت این رو صدا می‌زنه تا ببینه کدوم ساعت‌ها خالیه
    [HttpGet("available-slots")]
    public async Task<ActionResult<IEnumerable<AvailableSlotDto>>> GetAvailableSlots(
        [FromQuery] Guid doctorId, [FromQuery] DateTime date, CancellationToken ct)
        => Ok(await _service.GetAvailableSlotsAsync(doctorId, date, ct));

    // ─── POST /api/appointments ────────────────────────────────
    // ثبت نوبت جدید
    // درخواست: اطلاعات نوبت (بیمار، دکتر، تاریخ، ساعت، نوع)
    // پاسخ: نوبت ثبت شده با HTTP 201 (Created)
    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> Create(
        [FromBody] CreateAppointmentDto dto, CancellationToken ct)
    {
        try
        {
            if (User.IsInRole(nameof(UserRole.Patient)))
            {
                var patient = await GetCurrentPatientAsync(ct);
                if (patient == null) return Forbid();
                dto.PatientId = patient.Id;
            }

            if (!await _patientRepo.AnyAsync(p => p.Id == dto.PatientId, ct))
                return NotFound(new { message = "Patient not found." });

            var appt = await _service.CreateAsync(dto, ct);
            // CreatedAtAction = HTTP 201 + آدرس نوبت جدید در header
            return CreatedAtAction(nameof(GetById), new { id = appt.Id }, appt);
        }
        catch (InvalidOperationException ex)
        {
            // مثلاً: اون ساعت پر بود یا دکتر تعطیله → HTTP 400
            return BadRequest(new { message = ex.Message });
        }
    }

    // ─── PUT /api/appointments/{id} ────────────────────────────
    // ویرایش اطلاعات نوبت (تاریخ، ساعت، نوع، شکایت)
    // فقط دکتر و منشی می‌تونن ویرایش کنن
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<ActionResult<AppointmentDto>> Update(
        Guid id, [FromBody] UpdateAppointmentDto dto, CancellationToken ct)
    {
        try { return Ok(await _service.UpdateAsync(id, dto, ct)); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    // ─── PATCH /api/appointments/{id}/status ──────────────────
    // تغییر وضعیت نوبت (تأیید / لغو / انجام شد / نیامد)
    // PATCH فقط یه فیلد رو آپدیت می‌کنه (نه همه فیلدها مثل PUT)
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<ActionResult<AppointmentDto>> UpdateStatus(
        Guid id, [FromBody] UpdateAppointmentStatusDto dto, CancellationToken ct)
    {
        try { return Ok(await _service.UpdateStatusAsync(id, dto, ct)); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    // ─── DELETE /api/appointments/{id} ────────────────────────
    // حذف نوبت (فقط دکتر و منشی)
    // HTTP 204 = موفق، چیزی برگشت نمیده
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try { await _service.DeleteAsync(id, ct); return NoContent(); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    private async Task<Patient?> GetCurrentPatientAsync(CancellationToken ct)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out var userId)
            ? await _patientRepo.GetByUserIdAsync(userId, ct)
            : null;
    }

    private async Task<bool> CanAccessPatientAsync(Guid patientId, CancellationToken ct)
    {
        if (User.IsInRole(nameof(UserRole.SuperAdmin)) || User.IsInRole(nameof(UserRole.Admin)))
            return true;

        var patient = await GetCurrentPatientAsync(ct);
        return patient?.Id == patientId;
    }
}
