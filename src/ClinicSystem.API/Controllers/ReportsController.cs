using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin,Admin")]
public class ReportsController : ControllerBase
{
    private readonly IGenericRepository<Appointment> _appointments;
    private readonly IGenericRepository<Patient> _patients;
    private readonly IGenericRepository<OnlineConsultation> _consultations;
    private readonly IGenericRepository<MedicalRecord> _medicalRecords;

    public ReportsController(
        IGenericRepository<Appointment> appointments,
        IGenericRepository<Patient> patients,
        IGenericRepository<OnlineConsultation> consultations,
        IGenericRepository<MedicalRecord> medicalRecords)
    {
        _appointments = appointments;
        _patients = patients;
        _consultations = consultations;
        _medicalRecords = medicalRecords;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] string period = "month", CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.Date;
        var end = today.AddDays(1);
        var start = period.ToLowerInvariant() switch
        {
            "week" => today.AddDays(-6),
            "month" => new DateTime(today.Year, today.Month, 1),
            "year" => new DateTime(today.Year, 1, 1),
            _ => DateTime.MinValue
        };

        if (start == DateTime.MinValue)
            return BadRequest(new { message = "بازه گزارش نامعتبر است." });

        var previousEnd = start;
        var previousStart = start - (end - start);

        var currentAppointments = (await _appointments.FindAsync(
            x => x.AppointmentDate >= start && x.AppointmentDate < end, ct)).ToList();
        var previousAppointments = (await _appointments.FindAsync(
            x => x.AppointmentDate >= previousStart && x.AppointmentDate < previousEnd, ct)).ToList();
        var currentPatients = (await _patients.FindAsync(
            x => x.CreatedAt >= start && x.CreatedAt < end, ct)).ToList();
        var previousPatients = (await _patients.FindAsync(
            x => x.CreatedAt >= previousStart && x.CreatedAt < previousEnd, ct)).ToList();
        var currentConsultations = (await _consultations.FindAsync(
            x => x.RequestedAt >= start && x.RequestedAt < end, ct)).ToList();
        var previousConsultations = (await _consultations.FindAsync(
            x => x.RequestedAt >= previousStart && x.RequestedAt < previousEnd, ct)).ToList();
        var records = (await _medicalRecords.FindAsync(
            x => x.VisitDate >= start && x.VisitDate < end && x.Diagnosis != null, ct)).ToList();
        var allPatients = (await _patients.GetAllAsync(ct)).ToList();

        static decimal Change(int current, int previous) => previous == 0
            ? (current == 0 ? 0 : 100)
            : Math.Round((current - previous) * 100m / previous, 1);

        static decimal CancellationRate(IReadOnlyCollection<Appointment> items) => items.Count == 0
            ? 0
            : Math.Round(items.Count(x => x.Status == AppointmentStatus.Cancelled) * 100m / items.Count, 1);

        var trend = BuildTrend(period, start, end, currentAppointments);
        var topDiagnoses = records
            .Where(x => !string.IsNullOrWhiteSpace(x.Diagnosis))
            .GroupBy(x => x.Diagnosis!.Trim(), StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(x => x.Count())
            .Take(5)
            .Select(x => new { name = x.Key, count = x.Count() });

        var ageGroups = new[]
        {
            new { name = "0-17", count = allPatients.Count(x => x.Age < 18) },
            new { name = "18-30", count = allPatients.Count(x => x.Age is >= 18 and <= 30) },
            new { name = "31-45", count = allPatients.Count(x => x.Age is >= 31 and <= 45) },
            new { name = "46-60", count = allPatients.Count(x => x.Age is >= 46 and <= 60) },
            new { name = "61-75", count = allPatients.Count(x => x.Age is >= 61 and <= 75) },
            new { name = "75+", count = allPatients.Count(x => x.Age > 75) }
        };

        return Ok(new
        {
            from = start,
            to = today,
            kpis = new
            {
                newPatients = currentPatients.Count,
                newPatientsChange = Change(currentPatients.Count, previousPatients.Count),
                totalVisits = currentAppointments.Count,
                totalVisitsChange = Change(currentAppointments.Count, previousAppointments.Count),
                cancellationRate = CancellationRate(currentAppointments),
                cancellationRateChange = CancellationRate(currentAppointments) - CancellationRate(previousAppointments),
                onlineConsultations = currentConsultations.Count,
                onlineConsultationsChange = Change(currentConsultations.Count, previousConsultations.Count)
            },
            trend,
            visitTypes = new[]
            {
                new { name = "InPerson", value = currentAppointments.Count(x => x.Type == AppointmentType.InPerson) },
                new { name = "Online", value = currentAppointments.Count(x => x.Type == AppointmentType.Online) },
                new { name = "Consultation", value = currentConsultations.Count }
            },
            topDiagnoses,
            ageGroups
        });
    }

    private static IEnumerable<object> BuildTrend(
        string period,
        DateTime start,
        DateTime end,
        IReadOnlyCollection<Appointment> appointments)
    {
        if (period.Equals("year", StringComparison.OrdinalIgnoreCase))
        {
            for (var cursor = start; cursor < end; cursor = cursor.AddMonths(1))
            {
                var bucketEnd = cursor.AddMonths(1);
                var items = appointments.Where(x => x.AppointmentDate >= cursor && x.AppointmentDate < bucketEnd).ToList();
                yield return TrendPoint(cursor.ToString("yyyy-MM"), items);
            }
            yield break;
        }

        for (var cursor = start; cursor < end; cursor = cursor.AddDays(1))
        {
            var date = cursor;
            var items = appointments.Where(x => x.AppointmentDate.Date == date.Date).ToList();
            yield return TrendPoint(date.ToString("yyyy-MM-dd"), items);
        }
    }

    private static object TrendPoint(string label, IReadOnlyCollection<Appointment> items) => new
    {
        label,
        total = items.Count,
        completed = items.Count(x => x.Status == AppointmentStatus.Completed),
        cancelled = items.Count(x => x.Status == AppointmentStatus.Cancelled)
    };
}
