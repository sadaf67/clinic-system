// ══════════════════════════════════════════════════════════════
// Repository مخصوص بیماران
// از GenericRepository ارث می‌بره (کارهای پایه رو داره)
// و کارهای اختصاصی بیماران رو اینجا اضافه کردیم:
// - پیدا کردن بیمار با کد ملی
// - پیدا کردن بیمار با ID کاربر
// - گرفتن پرونده کامل بیمار (با همه جزئیات)
// - جستجو و صفحه‌بندی
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.Infrastructure.Repositories;

public class PatientRepository : GenericRepository<Patient>, IPatientRepository
{
    public PatientRepository(ClinicDbContext ctx) : base(ctx) { }

    // ─── پیدا کردن بیمار با شناسه کاربری ─────────────────────
    // هر بیمار یه حساب کاربری داره - با ID کاربر، پرونده بیمار رو پیدا می‌کنیم
    public async Task<Patient?> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet.Include(p => p.User)  // اطلاعات کاربری رو هم بارگذاری کن
                       .FirstOrDefaultAsync(p => p.UserId == userId, ct);

    // ─── پیدا کردن بیمار با کد ملی ───────────────────────────
    public async Task<Patient?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default)
        => await _dbSet.Include(p => p.User)
                       .FirstOrDefaultAsync(p => p.NationalCode == nationalCode, ct);

    // ─── گرفتن پرونده کامل بیمار (با همه جزئیات) ─────────────
    // این متد همه چیز رو یکجا میاره: پرونده‌ها، نسخه‌ها، علائم حیاتی، نوبت‌ها
    // مثل باز کردن یه پرونده فیزیکی که همه کاغذها توشه
    public async Task<Patient?> GetWithFullDetailsAsync(Guid patientId, CancellationToken ct = default)
        => await _dbSet
            .Include(p => p.User)                                        // اطلاعات کاربری
            .Include(p => p.MedicalRecords).ThenInclude(m => m.Files)   // پرونده‌ها + فایل‌هاشون
            .Include(p => p.Prescriptions).ThenInclude(pr => pr.Items)  // نسخه‌ها + داروهاشون
            .Include(p => p.VitalSigns)                                  // علائم حیاتی
            .Include(p => p.Appointments).ThenInclude(a => a.Doctor)    // نوبت‌ها + اطلاعات دکتر
            .FirstOrDefaultAsync(p => p.Id == patientId, ct);

    // ─── جستجو و صفحه‌بندی لیست بیماران ──────────────────────
    // برای صفحه "لیست بیماران" در پنل ادمین استفاده میشه
    // می‌شه با اسم، شماره یا کد ملی جستجو کرد
    public async Task<(IEnumerable<Patient> Items, int Total)> GetPagedAsync(
        string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _dbSet.Include(p => p.User).AsQueryable();

        // اگه کاربر چیزی سرچ کرده بود، فیلتر بزن
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower(); // بزرگ/کوچک رو یکسان کن

            // جستجو در: شماره موبایل، کد ملی، اسم کامل
            query = query.Where(p =>
                p.User.PhoneNumber!.Contains(s) ||
                p.NationalCode.Contains(s) ||
                (p.User.FirstName + " " + p.User.LastName).ToLower().Contains(s));
        }

        // تعداد کل بیماران (برای نمایش "نتیجه ۱ تا ۱۰ از ۱۵۰")
        var total = await query.CountAsync(ct);

        // بیماران صفحه X رو بگیر
        var items = await query
            .OrderByDescending(p => p.CreatedAt)   // جدیدترین بیماران اول
            .Skip((page - 1) * pageSize)            // صفحات قبلی رو رد کن
            .Take(pageSize)                         // تعداد مشخص بگیر
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetNamesByIdsAsync(
        IEnumerable<Guid> patientIds, CancellationToken ct = default)
    {
        var ids = patientIds.Distinct().ToArray();
        return await _dbSet
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.User.FirstName, p.User.LastName })
            .ToDictionaryAsync(
                p => p.Id,
                p => (p.FirstName + " " + p.LastName).Trim(),
                ct);
    }
}
