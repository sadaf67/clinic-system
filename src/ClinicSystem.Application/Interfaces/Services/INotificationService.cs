using ClinicSystem.Domain.Entities;

namespace ClinicSystem.Application.Interfaces.Services;

public interface INotificationService
{
    Task SendAppointmentReminderAsync(Appointment appointment, CancellationToken ct = default);
    Task SendAppointmentConfirmationAsync(Appointment appointment, CancellationToken ct = default);
    Task SendAppointmentCancellationAsync(Appointment appointment, CancellationToken ct = default);
    Task SendConsultationReplyAsync(OnlineConsultation consultation, CancellationToken ct = default);
    Task SendCustomNotificationAsync(Guid userId, string titleFa, string titleEn, string messageFa, string messageEn, CancellationToken ct = default);
    Task ProcessPendingRemindersAsync(CancellationToken ct = default);
}
