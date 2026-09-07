using ClinicSystem.Application.DTOs.Auth;

namespace ClinicSystem.Application.Interfaces.Services;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginDto dto, CancellationToken ct = default);
    Task<AuthResponseDto> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
    Task<AuthResponseDto> RegisterPatientAsync(RegisterPatientDto dto, CancellationToken ct = default);
    Task<bool> LogoutAsync(Guid userId, CancellationToken ct = default);
    Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto, CancellationToken ct = default);
    Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto, CancellationToken ct = default);
}
