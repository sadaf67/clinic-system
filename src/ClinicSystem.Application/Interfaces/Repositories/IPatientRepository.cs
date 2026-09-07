// ══════════════════════════════════════════════════════════════
// IPatientRepository — اینترفیس تخصصی بیماران
//
// علاوه بر عملیات عمومی، متدهای مخصوص جستجوی بیماران داره.
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Domain.Entities;

namespace ClinicSystem.Application.Interfaces.Repositories;

public interface IPatientRepository : IGenericRepository<Patient>
{
    // گرفتن اطلاعات بیمار با شناسه کاربریش
    // (هر Patient یه ApplicationUser مرتبط داره)
    Task<Patient?> GetByUserIdAsync(Guid userId, CancellationToken ct = default);

    // جستجوی بیمار با کد ملی (برای جلوگیری از ثبت تکراری)
    Task<Patient?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default);

    // گرفتن اطلاعات کامل بیمار با همه روابطش
    // (اطلاعات کاربر، نوبت‌ها، پرونده‌ها، نسخه‌ها و...)
    // Include = بارگذاری Navigation Properties
    Task<Patient?> GetWithFullDetailsAsync(Guid patientId, CancellationToken ct = default);

    // گرفتن لیست بیماران با جستجو و صفحه‌بندی
    // search = جستجو بر اساس نام، موبایل، کد ملی
    // Items = لیست، Total = تعداد کل
    Task<(IEnumerable<Patient> Items, int Total)> GetPagedAsync(
        string? search, int page, int pageSize, CancellationToken ct = default);

    Task<IReadOnlyDictionary<Guid, string>> GetNamesByIdsAsync(
        IEnumerable<Guid> patientIds, CancellationToken ct = default);
}
