using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/integrations")]
[Authorize]
public class IntegrationsController : ControllerBase
{
    private readonly ClinicDbContext _db;
    private readonly ITelemedicineService _telemedicine;
    private readonly IConfiguration _configuration;

    public IntegrationsController(ClinicDbContext db, ITelemedicineService telemedicine, IConfiguration configuration)
    {
        _db = db; _telemedicine = telemedicine; _configuration = configuration;
    }

    [HttpGet("status")]
    [Authorize(Roles = "SuperAdmin")]
    public IActionResult Status() => Ok(new
    {
        TelemedicineEnabled = _telemedicine.IsEnabled,
        GoogleCalendarEnabled = _configuration.GetValue<bool>("GoogleCalendar:Enabled"),
        ExternalMessagingDispatcherEnabled = false,
        Message = "External data transmission is disabled until provider credentials and explicit data-sharing approval are configured."
    });

    [HttpGet("calendar/{appointmentId:guid}.ics")]
    public async Task<IActionResult> ExportCalendar(Guid appointmentId, CancellationToken ct)
    {
        var appointment = await _db.Appointments.AsNoTracking().Include(x => x.Patient)
            .FirstOrDefaultAsync(x => x.Id == appointmentId, ct);
        if (appointment == null) return NotFound();
        if (!IsStaff() && appointment.Patient.UserId != CurrentUserId()) return Forbid();
        var start = appointment.AppointmentDate.Date.Add(appointment.StartTime);
        var end = appointment.AppointmentDate.Date.Add(appointment.EndTime);
        static string IcsDate(DateTime value) => value.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");
        static string Escape(string value) => value.Replace("\\", "\\\\").Replace(",", "\\,").Replace(";", "\\;").Replace("\n", "\\n");
        var ics = $"BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ClinicSystem//EN\r\nBEGIN:VEVENT\r\nUID:{appointment.Id}@clinic.local\r\nDTSTAMP:{IcsDate(DateTime.UtcNow)}\r\nDTSTART:{IcsDate(start)}\r\nDTEND:{IcsDate(end)}\r\nSUMMARY:{Escape("Clinic appointment")}\r\nDESCRIPTION:{Escape(appointment.ChiefComplaint ?? string.Empty)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        return File(Encoding.UTF8.GetBytes(ics), "text/calendar; charset=utf-8", $"appointment-{appointment.Id}.ics");
    }

    [HttpPost("telemedicine/{appointmentId:guid}/session")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> CreateSession(Guid appointmentId, CancellationToken ct)
    {
        if (!_telemedicine.IsEnabled) return Conflict(new { message = "Telemedicine provider is not configured." });
        var appointment = await _db.Appointments.FirstOrDefaultAsync(x => x.Id == appointmentId, ct);
        if (appointment == null) return NotFound();
        if (appointment.Type != AppointmentType.Online) return BadRequest(new { message = "Appointment is not online." });
        var existing = await _db.TelemedicineSessions.FirstOrDefaultAsync(x => x.AppointmentId == appointmentId, ct);
        if (existing != null) return Ok(new { existing.Id, existing.JoinUrl, existing.ExpiresAt });
        var room = _telemedicine.CreateRoom(appointmentId)!;
        var start = appointment.AppointmentDate.Date.Add(appointment.StartTime);
        var session = new TelemedicineSession
        {
            AppointmentId = appointmentId, Provider = "Configured", RoomId = room.RoomId,
            JoinUrl = room.JoinUrl, StartsAt = start, ExpiresAt = start.AddHours(2)
        };
        appointment.MeetingId = room.RoomId;
        appointment.MeetingLink = room.JoinUrl;
        _db.TelemedicineSessions.Add(session);
        await _db.SaveChangesAsync(ct);
        return Ok(new { session.Id, session.JoinUrl, session.ExpiresAt });
    }

    private bool IsStaff() => User.IsInRole("SuperAdmin") || User.IsInRole("Admin");
    private Guid CurrentUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
