using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/medical-files")]
[Authorize]
public class MedicalFilesController : ControllerBase
{
    private static readonly Dictionary<string, (string Extension, byte[] Signature)> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = (".pdf", "%PDF-"u8.ToArray()),
        ["image/jpeg"] = (".jpg", new byte[] { 0xFF, 0xD8, 0xFF }),
        ["image/png"] = (".png", new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })
    };

    private readonly ClinicDbContext _db;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;

    public MedicalFilesController(ClinicDbContext db, IWebHostEnvironment environment, IConfiguration configuration)
    {
        _db = db;
        _environment = environment;
        _configuration = configuration;
    }

    [HttpPost]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(
        IFormFile file, [FromForm] Guid? medicalRecordId, [FromForm] Guid? consultationId,
        [FromForm] string? description, CancellationToken ct)
    {
        if ((medicalRecordId.HasValue ? 1 : 0) + (consultationId.HasValue ? 1 : 0) != 1)
            return BadRequest(new { message = "Exactly one parent record is required." });
        var maxSize = _configuration.GetValue<long?>("FileStorage:MaxFileSizeBytes") ?? 10 * 1024 * 1024;
        if (file.Length <= 0 || file.Length > maxSize) return BadRequest(new { message = "Invalid file size." });
        if (!AllowedTypes.TryGetValue(file.ContentType, out var allowed))
            return BadRequest(new { message = "Only PDF, JPEG and PNG files are allowed." });
        if (!await CanAttachAsync(medicalRecordId, consultationId, ct)) return Forbid();

        await using var input = file.OpenReadStream();
        var header = new byte[Math.Max(8, allowed.Signature.Length)];
        var read = await input.ReadAsync(header, ct);
        if (read < allowed.Signature.Length || !header.AsSpan(0, allowed.Signature.Length).SequenceEqual(allowed.Signature))
            return BadRequest(new { message = "File signature does not match its declared type." });
        input.Position = 0;

        var storageKey = Path.Combine(DateTime.UtcNow.ToString("yyyy"), DateTime.UtcNow.ToString("MM"), $"{Guid.NewGuid():N}{allowed.Extension}");
        var root = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "App_Data", "medical-files"));
        var fullPath = Path.GetFullPath(Path.Combine(root, storageKey));
        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return BadRequest();
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        try
        {
            await using (var output = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
                await input.CopyToAsync(output, ct);
            await using var hashStream = System.IO.File.OpenRead(fullPath);
            var hash = Convert.ToHexString(await SHA256.HashDataAsync(hashStream, ct));
            var entity = new MedicalFile
            {
                MedicalRecordId = medicalRecordId, ConsultationId = consultationId,
                UploadedByUserId = CurrentUserId(), FileName = Path.GetFileName(file.FileName),
                FileUrl = string.Empty, StorageKey = storageKey, FileType = file.ContentType,
                FileSizeBytes = file.Length, Description = description?.Trim(), Sha256 = hash,
                ScanStatus = FileScanStatus.Clean, ScanMessage = "Signature validation passed. External malware scanner not configured."
            };
            _db.MedicalFiles.Add(entity);
            await _db.SaveChangesAsync(ct);
            entity.FileUrl = $"/api/medical-files/{entity.Id}/download";
            await _db.SaveChangesAsync(ct);
            return Ok(new { entity.Id, entity.FileName, entity.FileType, entity.FileSizeBytes, entity.Sha256, entity.ScanStatus });
        }
        catch
        {
            if (System.IO.File.Exists(fullPath)) System.IO.File.Delete(fullPath);
            throw;
        }
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var entity = await _db.MedicalFiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity == null) return NotFound();
        if (!await CanAttachAsync(entity.MedicalRecordId, entity.ConsultationId, ct)) return Forbid();
        if (entity.ScanStatus != FileScanStatus.Clean) return Conflict(new { message = "File has not passed validation." });
        var root = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "App_Data", "medical-files"));
        var fullPath = Path.GetFullPath(Path.Combine(root, entity.StorageKey));
        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(fullPath)) return NotFound();
        return PhysicalFile(fullPath, entity.FileType, entity.FileName, enableRangeProcessing: true);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entity = await _db.MedicalFiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity == null) return NotFound();
        entity.MarkAsDeleted();
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsStaff() => User.IsInRole("SuperAdmin") || User.IsInRole("Admin");

    private async Task<bool> CanAttachAsync(Guid? recordId, Guid? consultationId, CancellationToken ct)
    {
        if (IsStaff()) return true;
        var userId = CurrentUserId();
        if (recordId.HasValue)
            return await _db.MedicalRecords.AnyAsync(x => x.Id == recordId && x.Patient.UserId == userId, ct);
        return consultationId.HasValue && await _db.Consultations
            .AnyAsync(x => x.Id == consultationId && x.Patient.UserId == userId, ct);
    }
}
