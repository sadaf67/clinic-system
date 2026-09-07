// ══════════════════════════════════════════════════════════════
// این کلاس "انبار عمومی" (Generic Repository) هست
// برای هر جدول دیتابیس، کارهای تکراری مثل:
// گرفتن، اضافه کردن، ویرایش، حذف، شمردن
// یه بار نوشتیم اینجا تا هزار بار تکرار نشه
// T یه نوع متغیره - مثلاً GenericRepository<Patient> = Repository بیماران
// ══════════════════════════════════════════════════════════════
using System.Linq.Expressions;
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Common;
using ClinicSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.Infrastructure.Repositories;

// where T : BaseEntity یعنی فقط برای کلاس‌هایی کار می‌کنه که از BaseEntity ارث بردن
public class GenericRepository<T> : IGenericRepository<T> where T : BaseEntity
{
    // اتصال به دیتابیس
    protected readonly ClinicDbContext _ctx;

    // جدول مربوط به T (مثلاً اگه T=Patient باشه، این جدول Patients هست)
    protected readonly DbSet<T> _dbSet;

    public GenericRepository(ClinicDbContext ctx)
    {
        _ctx = ctx;
        _dbSet = ctx.Set<T>(); // جدول T رو از DbContext بگیر
    }

    // ─── پیدا کردن یه رکورد با ID ─────────────────────────────
    // مثل: SELECT * FROM Patients WHERE Id = '...'
    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(e => e.Id == id, ct);

    // ─── گرفتن همه رکوردها ────────────────────────────────────
    // مثل: SELECT * FROM Patients
    public async Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet.ToListAsync(ct);

    // ─── پیدا کردن رکوردها با شرط ────────────────────────────
    // predicate یه شرط هست که می‌فرستیم
    // مثلاً: FindAsync(p => p.Gender == Gender.Male) = پیدا کن بیماران مرد
    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await _dbSet.Where(predicate).ToListAsync(ct);

    // ─── پیدا کردن اولین رکورد با شرط ────────────────────────
    public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(predicate, ct);

    // ─── چک کردن وجود داشتن ──────────────────────────────────
    // مثل: SELECT COUNT(*) > 0 FROM Patients WHERE NationalCode = '123'
    // سریع‌تر از گرفتن کل رکورد و چک کردن null
    public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await _dbSet.AnyAsync(predicate, ct);

    // ─── شمردن رکوردها ────────────────────────────────────────
    // اگه شرط نداشت: SELECT COUNT(*) FROM Patients
    // اگه شرط داشت: SELECT COUNT(*) FROM Patients WHERE ...
    public async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default)
        => predicate == null
            ? await _dbSet.CountAsync(ct)
            : await _dbSet.CountAsync(predicate, ct);

    // ─── اضافه کردن رکورد جدید ────────────────────────────────
    // مثل: INSERT INTO Patients VALUES (...)
    // توجه: هنوز ذخیره نشده! باید بعدش SaveChangesAsync صدا بزنی
    public async Task AddAsync(T entity, CancellationToken ct = default)
        => await _dbSet.AddAsync(entity, ct);

    // ─── ویرایش رکورد ─────────────────────────────────────────
    // مثل: UPDATE Patients SET ... WHERE Id = '...'
    // توجه: هنوز ذخیره نشده! باید بعدش SaveChangesAsync صدا بزنی
    public void Update(T entity) => _dbSet.Update(entity);

    // ─── حذف رکورد ────────────────────────────────────────────
    // این حذف واقعی هست (نه soft delete) - مستقیم از دیتابیس پاک میشه
    // توجه: هنوز ذخیره نشده! باید بعدش SaveChangesAsync صدا بزنی
    public void Remove(T entity) => _dbSet.Remove(entity);

    // ─── ذخیره تغییرات در دیتابیس ────────────────────────────
    // همه تغییراتی که با Add، Update، Remove دادیم رو یکجا ذخیره می‌کنه
    // مثل: فشار دادن دکمه Save
    // عدد برگشتی = تعداد ردیف‌هایی که تغییر کردن
    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await _ctx.SaveChangesAsync(ct);
}
