namespace ClinicSystem.Infrastructure.Data;

public sealed record AuditActor(Guid? UserId, string Name, string? IpAddress, string CorrelationId);

public static class AuditContext
{
    private static readonly AsyncLocal<AuditActor?> State = new();
    public static AuditActor? Current { get => State.Value; set => State.Value = value; }
}
