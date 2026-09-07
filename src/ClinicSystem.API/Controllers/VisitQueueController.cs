using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Domain.Services;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/visit-queue")]
[Authorize(Roles = "SuperAdmin,Admin")]
public class VisitQueueController : ControllerBase
{
    private readonly ClinicDbContext _db;
    public VisitQueueController(ClinicDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateTime? date, [FromQuery] Guid? branchId, CancellationToken ct)
    {
        var day = (date ?? DateTime.UtcNow).Date;
        return Ok(await _db.VisitQueueItems.AsNoTracking()
            .Include(x => x.Appointment).ThenInclude(x => x.Patient).ThenInclude(x => x.User)
            .Where(x => x.CheckedInAt >= day && x.CheckedInAt < day.AddDays(1) && (!branchId.HasValue || x.BranchId == branchId))
            .OrderBy(x => x.QueueNumber)
            .Select(x => new
            {
                x.Id, x.AppointmentId, x.BranchId, x.QueueNumber, x.Status,
                x.CheckedInAt, x.CalledAt, x.StartedAt, x.CompletedAt, x.Notes,
                PatientName = x.Appointment.Patient.User.FullName,
                x.Appointment.StartTime, x.Appointment.DoctorId
            }).ToListAsync(ct));
    }

    [HttpPost("check-in/{appointmentId:guid}")]
    public async Task<IActionResult> CheckIn(Guid appointmentId, CheckInRequest request, CancellationToken ct)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await _db.Appointments.FirstOrDefaultAsync(x => x.Id == appointmentId, ct);
        if (appointment == null) return NotFound();
        if (appointment.Status is AppointmentStatus.Cancelled or AppointmentStatus.Completed or AppointmentStatus.NoShow)
            return Conflict(new { message = "Appointment cannot be checked in in its current state." });
        if (await _db.VisitQueueItems.AnyAsync(x => x.AppointmentId == appointmentId, ct))
            return Conflict(new { message = "Appointment is already checked in." });

        var start = DateTime.UtcNow.Date;
        var lastNumber = await _db.VisitQueueItems
            .Where(x => x.CheckedInAt >= start && x.CheckedInAt < start.AddDays(1) && x.BranchId == appointment.BranchId)
            .MaxAsync(x => (int?)x.QueueNumber, ct) ?? 0;
        var item = new VisitQueueItem
        {
            AppointmentId = appointmentId, BranchId = appointment.BranchId,
            QueueNumber = lastNumber + 1, Status = VisitQueueStatus.Waiting, Notes = request.Notes?.Trim()
        };
        _db.VisitQueueItems.Add(item);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { item.Id, item.QueueNumber, item.Status });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, QueueStatusRequest request, CancellationToken ct)
    {
        var item = await _db.VisitQueueItems.Include(x => x.Appointment).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound();
        if (!VisitQueueWorkflow.CanTransition(item.Status, request.Status))
            return Conflict(new { message = $"Invalid transition: {item.Status} -> {request.Status}." });

        item.Status = request.Status;
        item.Notes = request.Notes?.Trim() ?? item.Notes;
        var now = DateTime.UtcNow;
        if (request.Status == VisitQueueStatus.Called) item.CalledAt = now;
        if (request.Status == VisitQueueStatus.InVisit) item.StartedAt = now;
        if (request.Status == VisitQueueStatus.Completed)
        {
            item.CompletedAt = now;
            item.Appointment.Status = AppointmentStatus.Completed;
        }
        if (request.Status == VisitQueueStatus.NoShow) item.Appointment.Status = AppointmentStatus.NoShow;
        if (request.Status == VisitQueueStatus.Cancelled) item.Appointment.Status = AppointmentStatus.Cancelled;
        await _db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Status, item.CalledAt, item.StartedAt, item.CompletedAt });
    }

}

public sealed record CheckInRequest(string? Notes);
public sealed record QueueStatusRequest(VisitQueueStatus Status, string? Notes);
