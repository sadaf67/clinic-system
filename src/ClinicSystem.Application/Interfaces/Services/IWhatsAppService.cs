namespace ClinicSystem.Application.Interfaces.Services;

public interface IWhatsAppService
{
    Task<bool> SendMessageAsync(string phoneNumber, string message, CancellationToken ct = default);
    Task<bool> SendTemplateAsync(string phoneNumber, string templateName, List<string> parameters, CancellationToken ct = default);
}
