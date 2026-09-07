namespace ClinicSystem.Application.Interfaces.Services;

public interface ISmsService
{
    Task<bool> SendAsync(string mobile, string message, CancellationToken ct = default);
    Task<bool> SendTemplateAsync(string mobile, string templateName, Dictionary<string, string> parameters, CancellationToken ct = default);
}
