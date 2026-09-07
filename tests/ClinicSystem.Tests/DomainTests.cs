using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Domain.Services;
using Xunit;

namespace ClinicSystem.Tests;

public class DomainTests
{
    [Theory]
    [InlineData(VisitQueueStatus.Waiting, VisitQueueStatus.Called, true)]
    [InlineData(VisitQueueStatus.Called, VisitQueueStatus.InVisit, true)]
    [InlineData(VisitQueueStatus.InVisit, VisitQueueStatus.Completed, true)]
    [InlineData(VisitQueueStatus.Completed, VisitQueueStatus.Waiting, false)]
    [InlineData(VisitQueueStatus.Waiting, VisitQueueStatus.Completed, false)]
    public void Queue_transitions_are_explicit(VisitQueueStatus current, VisitQueueStatus next, bool expected)
        => Assert.Equal(expected, VisitQueueWorkflow.CanTransition(current, next));

    [Fact]
    public void Invoice_totals_only_successful_payments()
    {
        var invoice = new Invoice
        {
            DiscountAmount = 100,
            InsuranceAmount = 200,
            Items = new List<InvoiceItem>
            {
                new() { Description = "Visit", Quantity = 2, UnitPrice = 1000 }
            },
            Payments = new List<Payment>
            {
                new() { Amount = 500, Status = PaymentStatus.Succeeded },
                new() { Amount = 300, Status = PaymentStatus.Failed }
            }
        };
        Assert.Equal(2000, invoice.Subtotal);
        Assert.Equal(1700, invoice.Total);
        Assert.Equal(500, invoice.PaidAmount);
    }

    [Fact]
    public void Completed_appointment_is_not_due_for_reminder()
    {
        var appointment = new Appointment
        {
            AppointmentDate = DateTime.UtcNow.AddDays(1),
            Status = AppointmentStatus.Completed,
            ReminderSent = false
        };
        Assert.False(appointment.IsReminderDue);
    }
}
