using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class Invoice : BaseEntity
{
    public string Number { get; set; } = string.Empty;
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public Guid? BranchId { get; set; }
    public ClinicBranch? Branch { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DueAt { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal InsuranceAmount { get; set; }
    public string Currency { get; set; } = "IRR";
    public string? Notes { get; set; }
    public ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public decimal Subtotal => Items.Sum(x => x.Quantity * x.UnitPrice);
    public decimal Total => Math.Max(0, Subtotal - DiscountAmount - InsuranceAmount);
    public decimal PaidAmount => Payments.Where(x => x.Status == PaymentStatus.Succeeded).Sum(x => x.Amount);
}

public class InvoiceItem : BaseEntity
{
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
}

public class Payment : BaseEntity
{
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Method { get; set; } = "Cash";
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? Gateway { get; set; }
    public string? GatewayReference { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime? PaidAt { get; set; }
}

public class InsuranceClaim : BaseEntity
{
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public string Provider { get; set; } = string.Empty;
    public string PolicyNumber { get; set; } = string.Empty;
    public string ClaimNumber { get; set; } = string.Empty;
    public decimal ClaimedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public InsuranceClaimStatus Status { get; set; } = InsuranceClaimStatus.Draft;
    public DateTime? SubmittedAt { get; set; }
    public string? RejectionReason { get; set; }
}

public class InventoryItem : BaseEntity
{
    public Guid? BranchId { get; set; }
    public ClinicBranch? Branch { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public string? BatchNumber { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<InventoryTransaction> Transactions { get; set; } = new List<InventoryTransaction>();
}

public class InventoryTransaction : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;
    public InventoryTransactionType Type { get; set; }
    public decimal QuantityDelta { get; set; }
    public decimal BalanceAfter { get; set; }
    public Guid PerformedByUserId { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
}

public class CalendarSyncRecord : BaseEntity
{
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = null!;
    public Guid UserId { get; set; }
    public string Provider { get; set; } = "Google";
    public string? ExternalEventId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime? LastSyncedAt { get; set; }
    public string? LastError { get; set; }
}

public class TelemedicineSession : BaseEntity
{
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = null!;
    public string Provider { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string JoinUrl { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
}
