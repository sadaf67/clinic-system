using ClinicSystem.Application.Interfaces.Services;
using Microsoft.Extensions.Configuration;

namespace ClinicSystem.Infrastructure.Services.Messaging;

public sealed class ConfiguredTelemedicineService : ITelemedicineService
{
    private readonly string? _baseUrl;
    public bool IsEnabled { get; }

    public ConfiguredTelemedicineService(IConfiguration configuration)
    {
        IsEnabled = configuration.GetValue<bool>("Telemedicine:Enabled");
        _baseUrl = configuration["Telemedicine:BaseUrl"]?.TrimEnd('/');
        if (IsEnabled && (!Uri.TryCreate(_baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException("Telemedicine:BaseUrl must be an absolute HTTPS URL when enabled.");
    }

    public TelemedicineRoom? CreateRoom(Guid appointmentId)
    {
        if (!IsEnabled || string.IsNullOrWhiteSpace(_baseUrl)) return null;
        var roomId = $"clinic-{appointmentId:N}-{Guid.NewGuid():N}";
        return new TelemedicineRoom(roomId, $"{_baseUrl}/{roomId}");
    }
}
