using ClinicSystem.Application.DTOs.Appointment;

namespace ClinicSystem.Application.Interfaces.Services;

public interface IAppointmentService
{
    Task<AppointmentDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<AppointmentDto>> GetPagedAsync(AppointmentFilterDto filter, CancellationToken ct = default);
    Task<AppointmentDto> CreateAsync(CreateAppointmentDto dto, CancellationToken ct = default);
    Task<AppointmentDto> UpdateAsync(Guid id, UpdateAppointmentDto dto, CancellationToken ct = default);
    Task<AppointmentDto> UpdateStatusAsync(Guid id, UpdateAppointmentStatusDto dto, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<IEnumerable<AvailableSlotDto>> GetAvailableSlotsAsync(Guid doctorId, DateTime date, CancellationToken ct = default);
    Task<IEnumerable<AppointmentDto>> GetTodayAppointmentsAsync(Guid doctorId, CancellationToken ct = default);
}
