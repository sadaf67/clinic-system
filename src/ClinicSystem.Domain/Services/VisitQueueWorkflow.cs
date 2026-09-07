using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Services;

public static class VisitQueueWorkflow
{
    public static bool CanTransition(VisitQueueStatus current, VisitQueueStatus next) => (current, next) switch
    {
        (VisitQueueStatus.CheckedIn, VisitQueueStatus.Waiting) => true,
        (VisitQueueStatus.Waiting, VisitQueueStatus.Called) => true,
        (VisitQueueStatus.Called, VisitQueueStatus.InVisit) => true,
        (VisitQueueStatus.InVisit, VisitQueueStatus.Completed) => true,
        (_, VisitQueueStatus.NoShow) when current is VisitQueueStatus.Waiting or VisitQueueStatus.Called => true,
        (_, VisitQueueStatus.Cancelled) when current is not VisitQueueStatus.Completed => true,
        _ => false
    };
}
