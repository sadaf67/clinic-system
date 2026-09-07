using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/billing")]
[Authorize]
public class BillingController : ControllerBase
{
    private static readonly HashSet<string> PaymentMethods = new(StringComparer.OrdinalIgnoreCase)
        { "Cash", "Card", "Transfer", "Manual" };
    private readonly ClinicDbContext _db;
    public BillingController(ClinicDbContext db) => _db = db;

    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices([FromQuery] Guid? patientId, CancellationToken ct)
    {
        if (!IsStaff())
        {
            var userId = CurrentUserId();
            patientId = await _db.Patients.Where(x => x.UserId == userId).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
            if (!patientId.HasValue) return Forbid();
        }
        var query = _db.Invoices.AsNoTracking().Include(x => x.Items).Include(x => x.Payments).AsQueryable();
        if (patientId.HasValue) query = query.Where(x => x.PatientId == patientId);
        var invoices = await query.OrderByDescending(x => x.IssuedAt).Take(200).ToListAsync(ct);
        return Ok(invoices.Select(ToDto));
    }

    [HttpPost("invoices")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> CreateInvoice(CreateInvoiceRequest request, CancellationToken ct)
    {
        if (!await _db.Patients.AnyAsync(x => x.Id == request.PatientId, ct)) return NotFound();
        if (request.Items.Count == 0 || request.Items.Any(x => string.IsNullOrWhiteSpace(x.Description) || x.Quantity <= 0 || x.UnitPrice < 0))
            return BadRequest(new { message = "At least one valid invoice item is required." });
        if (request.DiscountAmount < 0 || request.InsuranceAmount < 0)
            return BadRequest(new { message = "Amounts cannot be negative." });

        var invoice = new Invoice
        {
            Number = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
            PatientId = request.PatientId, AppointmentId = request.AppointmentId, BranchId = request.BranchId,
            DueAt = request.DueAt, DiscountAmount = request.DiscountAmount,
            InsuranceAmount = request.InsuranceAmount, Notes = request.Notes?.Trim(),
            Status = InvoiceStatus.Issued,
            Items = request.Items.Select(x => new InvoiceItem
            {
                Description = x.Description.Trim(), Quantity = x.Quantity, UnitPrice = x.UnitPrice
            }).ToList()
        };
        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(invoice));
    }

    [HttpPost("invoices/{id:guid}/payments")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> AddPayment(Guid id, AddPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0 || string.IsNullOrWhiteSpace(request.IdempotencyKey) || !PaymentMethods.Contains(request.Method))
            return BadRequest(new { message = "Positive amount, supported method and idempotency key are required." });
        var key = request.IdempotencyKey.Trim();
        var existing = await _db.Payments.AsNoTracking().FirstOrDefaultAsync(x => x.IdempotencyKey == key, ct);
        if (existing != null) return Ok(new { existing.Id, existing.Status, existing.Amount, replayed = true });

        var invoice = await _db.Invoices.Include(x => x.Items).Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (invoice == null) return NotFound();
        if (invoice.Status is InvoiceStatus.Void or InvoiceStatus.Paid) return Conflict(new { message = "Invoice is not payable." });
        if (request.Amount > invoice.Total - invoice.PaidAmount) return BadRequest(new { message = "Payment exceeds outstanding amount." });
        var payment = new Payment
        {
            InvoiceId = id, Amount = request.Amount, Method = request.Method,
            IdempotencyKey = key, Status = PaymentStatus.Succeeded,
            GatewayReference = request.Reference?.Trim(), PaidAt = DateTime.UtcNow
        };
        invoice.Payments.Add(payment);
        invoice.Status = invoice.PaidAmount >= invoice.Total ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
        await _db.SaveChangesAsync(ct);
        return Ok(new { payment.Id, PaymentStatus = payment.Status, payment.Amount, InvoiceStatus = invoice.Status });
    }

    [HttpPost("invoices/{id:guid}/void")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> VoidInvoice(Guid id, CancellationToken ct)
    {
        var invoice = await _db.Invoices.Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (invoice == null) return NotFound();
        if (invoice.Payments.Any(x => x.Status == PaymentStatus.Succeeded))
            return Conflict(new { message = "Paid invoice cannot be voided before refund." });
        invoice.Status = InvoiceStatus.Void;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("invoices/{id:guid}/insurance-claims")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> CreateClaim(Guid id, CreateClaimRequest request, CancellationToken ct)
    {
        if (!await _db.Invoices.AnyAsync(x => x.Id == id, ct)) return NotFound();
        if (request.ClaimedAmount <= 0 || string.IsNullOrWhiteSpace(request.Provider) || string.IsNullOrWhiteSpace(request.PolicyNumber))
            return BadRequest(new { message = "Invalid insurance claim." });
        var claim = new InsuranceClaim
        {
            InvoiceId = id, Provider = request.Provider.Trim(), PolicyNumber = request.PolicyNumber.Trim(),
            ClaimNumber = $"CLM-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
            ClaimedAmount = request.ClaimedAmount, Status = InsuranceClaimStatus.Draft
        };
        _db.InsuranceClaims.Add(claim);
        await _db.SaveChangesAsync(ct);
        return Ok(new { claim.Id, claim.ClaimNumber, claim.Status });
    }

    [HttpPatch("insurance-claims/{id:guid}/status")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<IActionResult> UpdateClaim(Guid id, UpdateClaimRequest request, CancellationToken ct)
    {
        var claim = await _db.InsuranceClaims.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (claim == null) return NotFound();
        if (request.ApprovedAmount < 0 || request.ApprovedAmount > claim.ClaimedAmount)
            return BadRequest(new { message = "Approved amount is invalid." });
        claim.Status = request.Status;
        claim.ApprovedAmount = request.ApprovedAmount;
        claim.RejectionReason = request.RejectionReason?.Trim();
        if (request.Status == InsuranceClaimStatus.Submitted) claim.SubmittedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { claim.Id, claim.Status, claim.ApprovedAmount });
    }

    private bool IsStaff() => User.IsInRole("SuperAdmin") || User.IsInRole("Admin");
    private Guid CurrentUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static object ToDto(Invoice x) => new
    {
        x.Id, x.Number, x.PatientId, x.AppointmentId, x.BranchId, x.Status, x.IssuedAt, x.DueAt,
        x.DiscountAmount, x.InsuranceAmount, x.Currency, x.Notes,
        x.Subtotal, x.Total, x.PaidAmount, OutstandingAmount = x.Total - x.PaidAmount,
        Items = x.Items.Select(i => new { i.Id, i.Description, i.Quantity, i.UnitPrice }),
        Payments = x.Payments.Select(p => new { p.Id, p.Amount, p.Method, p.Status, p.PaidAt, p.GatewayReference })
    };
}

public sealed record InvoiceLineRequest(string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateInvoiceRequest(Guid PatientId, Guid? AppointmentId, Guid? BranchId, DateTime? DueAt,
    decimal DiscountAmount, decimal InsuranceAmount, string? Notes, List<InvoiceLineRequest> Items);
public sealed record AddPaymentRequest(decimal Amount, string Method, string IdempotencyKey, string? Reference);
public sealed record CreateClaimRequest(string Provider, string PolicyNumber, decimal ClaimedAmount);
public sealed record UpdateClaimRequest(InsuranceClaimStatus Status, decimal? ApprovedAmount, string? RejectionReason);
