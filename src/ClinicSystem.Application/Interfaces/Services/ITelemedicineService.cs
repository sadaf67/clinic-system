namespace ClinicSystem.Application.Interfaces.Services;

public sealed record TelemedicineRoom(string RoomId, string JoinUrl);

public interface ITelemedicineService
{
    TelemedicineRoom? CreateRoom(Guid appointmentId);
    bool IsEnabled { get; }
}
