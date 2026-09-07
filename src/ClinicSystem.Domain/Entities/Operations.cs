using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class ClinicBranch : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public string TimeZoneId { get; set; } = "Iran Standard Time";
    public bool IsActive { get; set; } = true;
}

public class VisitQueueItem : BaseEntity
{
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = null!;
    public Guid? BranchId { get; set; }
    public ClinicBranch? Branch { get; set; }
    public int QueueNumber { get; set; }
    public VisitQueueStatus Status { get; set; } = VisitQueueStatus.CheckedIn;
    public DateTime CheckedInAt { get; set; } = DateTime.UtcNow;
    public DateTime? CalledAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
}

public class AuditLog : BaseEntity
{
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? IpAddress { get; set; }
    public string CorrelationId { get; set; } = string.Empty;
}

public class MedicalRecordVersion : BaseEntity
{
    public Guid MedicalRecordId { get; set; }
    public MedicalRecord MedicalRecord { get; set; } = null!;
    public int VersionNumber { get; set; }
    public Guid ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string SnapshotJson { get; set; } = string.Empty;
    public string? ChangeReason { get; set; }
}

public class OutboxMessage : BaseEntity
{
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime AvailableAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public int AttemptCount { get; set; }
    public int MaxAttempts { get; set; } = 5;
    public string? LastError { get; set; }
    public Guid? LockId { get; set; }
    public DateTime? LockedUntil { get; set; }
}
