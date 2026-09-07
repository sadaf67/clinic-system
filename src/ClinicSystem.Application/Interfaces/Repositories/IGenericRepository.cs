// ══════════════════════════════════════════════════════════════
// IGenericRepository — اینترفیس ریپازیتوری عمومی
//
// این اینترفیس مثل یه "قالب" هست برای همه عملیات‌های دیتابیس.
// هر Entity (جدول) می‌تونه از این قالب استفاده کنه.
//
// مثلاً: IGenericRepository<Patient> = عملیات جدول بیماران
//        IGenericRepository<Appointment> = عملیات جدول نوبت‌ها
//
// فلسفه: کد خوندن/نوشتن دیتابیس رو یه جا نگه‌داریم
// تا در هر جایی از برنامه نیاز شد، ازش استفاده کنیم.
//
// T : BaseEntity → فقط Entity‌هایی که از BaseEntity ارث بردن
// می‌تونن اینجا استفاده بشن (مثلاً Patient، Appointment و...)
// ══════════════════════════════════════════════════════════════

using System.Linq.Expressions;
using ClinicSystem.Domain.Common;

namespace ClinicSystem.Application.Interfaces.Repositories;

// where T : BaseEntity = این ریپازیتوری فقط برای Entity‌هاست
public interface IGenericRepository<T> where T : BaseEntity
{
    // ── خواندن (Read) ───────────────────────────────────────────

    // گرفتن یه آیتم با id — اگه پیدا نشد null برمیگردونه
    Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);

    // گرفتن همه آیتم‌ها (بدون فیلتر)
    Task<IEnumerable<T>> GetAllAsync(CancellationToken ct = default);

    // گرفتن آیتم‌هایی که شرط رو دارن
    // predicate = یه لامبدا مثل: x => x.IsActive == true
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    // گرفتن اولین آیتمی که شرط رو داره — اگه نبود null
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    // آیا حداقل یه آیتم با این شرط وجود داره؟ (بله/خیر)
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    // شمردن تعداد آیتم‌ها (با یا بدون فیلتر)
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);

    // ── نوشتن (Write) ───────────────────────────────────────────

    // اضافه کردن آیتم جدید به دیتابیس
    Task AddAsync(T entity, CancellationToken ct = default);

    // آپدیت کردن آیتم موجود (void چون فوری ذخیره نمیشه)
    void Update(T entity);

    // حذف آیتم (Soft Delete در پیاده‌سازی اعمال میشه)
    void Remove(T entity);

    // ذخیره همه تغییرات در دیتابیس — باید در آخر صدا زده بشه
    // (مثل دکمه Save در ورد)
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
