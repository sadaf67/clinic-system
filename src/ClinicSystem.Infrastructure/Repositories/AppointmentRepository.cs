// ══════════════════════════════════════════════════════════════
// این Repository مخصوص نوبت‌هاست
// از GenericRepository ارث می‌بره (یعنی کارهای پایه رو داره)
// و کارهای اختصاصی نوبت‌ها رو اینجا اضافه کردیم:
// - گرفتن نوبت‌های یه بیمار
// - گرفتن نوبت‌های یه دکتر در یه روز
// - پیدا کردن نوبت‌هایی که باید یادآور بفرستیم
// - چک کردن خالی بودن یه اسلات زمانی
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.Infrastructure.Repositories;

public class AppointmentRepository : GenericRepository<Appointment>, IAppointmentRepository
{
    // سازنده - فقط ClinicDbContext رو به کلاس پدر پاس میده
    public AppointmentRepository(ClinicDbContext ctx) : base(ctx) { }

    public async Task<Appointment?> GetWithDetailsAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Include(a => a.Doctor)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

    // ─── گرفتن همه نوبت‌های یه بیمار ─────────────────────────
    // Include = جوین با جداول دیگه (مثل JOIN در SQL)
    // بیمار رو میخوایم + اطلاعات کاربر بیمار رو هم میخوایم + دکتر رو هم میخوایم
    public async Task<IEnumerable<Appointment>> GetByPatientIdAsync(Guid patientId, CancellationToken ct = default)
        => await _dbSet
            .Include(a => a.Doctor)                          // اطلاعات دکتر
            .Include(a => a.Patient).ThenInclude(p => p.User) // اطلاعات بیمار + اطلاعات کاربری‌اش
            .Where(a => a.PatientId == patientId)            // فیلتر: فقط این بیمار
            .OrderByDescending(a => a.AppointmentDate)       // جدیدترین نوبت اول
            .ToListAsync(ct);

    // ─── گرفتن نوبت‌های یه دکتر (با فیلتر روز) ───────────────
    // اگه date بدیم، فقط نوبت‌های اون روز رو میده
    // اگه date ندیم، همه نوبت‌های دکتر رو میده
    public async Task<IEnumerable<Appointment>> GetByDoctorIdAsync(Guid doctorId, DateTime? date = null, CancellationToken ct = default)
    {
        // query یه کوئری قابل فیلتر کردن هست - مثل ساختن یه سوال که هنوز اجرا نشده
        var query = _dbSet
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Where(a => a.DoctorId == doctorId);

        // اگه تاریخ دادن، فیلتر بزن
        if (date.HasValue)
            query = query.Where(a => a.AppointmentDate.Date == date.Value.Date);

        // مرتب‌سازی بر اساس ساعت شروع
        return await query.OrderBy(a => a.StartTime).ToListAsync(ct);
    }

    // ─── پیدا کردن نوبت‌هایی که باید یادآور فرستاد ──────────
    // هر شب این متد صدا زده میشه تا نوبت‌های فردا رو پیدا کنه
    // شرط‌ها: یادآور نفرستادیم AND نوبت تأیید شده AND نوبت فرداست
    public async Task<IEnumerable<Appointment>> GetPendingRemindersAsync(CancellationToken ct = default)
    {
        var tomorrow = DateTime.UtcNow.AddDays(1).Date; // تاریخ فردا
        return await _dbSet
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Where(a =>
                !a.ReminderSent &&                              // هنوز یادآور نفرستادیم
                a.Status == AppointmentStatus.Confirmed &&      // نوبت تأیید شده
                a.AppointmentDate.Date == tomorrow)             // نوبت فرداست
            .ToListAsync(ct);
    }

    // ─── گرفتن نوبت‌های یه بازه زمانی ────────────────────────
    // برای نمودار هفتگی داشبورد استفاده میشه
    // مثلاً: نوبت‌های ۷ روز گذشته رو بده
    public async Task<IEnumerable<Appointment>> GetByDateRangeAsync(DateTime start, DateTime end, CancellationToken ct = default)
        => await _dbSet
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Include(a => a.Doctor)
            .Where(a => a.AppointmentDate.Date >= start.Date && a.AppointmentDate.Date <= end.Date)
            .OrderBy(a => a.AppointmentDate).ThenBy(a => a.StartTime) // ترتیب: تاریخ، بعد ساعت
            .ToListAsync(ct);

    // ─── چک کردن خالی بودن اسلات زمانی ──────────────────────
    // قبل از ثبت نوبت جدید، مطمئن میشیم دکتر در اون ساعت نوبت دیگه‌ای نداره
    // منطق: اگه هیچ نوبت تأیید/در انتظاری در اون بازه نداریم، اسلات خالیه
    public async Task<bool> IsSlotAvailableAsync(
        Guid doctorId, DateTime date, TimeSpan startTime, TimeSpan endTime,
        Guid? excludeAppointmentId = null, CancellationToken ct = default)
        => !await _dbSet.AnyAsync(a =>
            a.DoctorId == doctorId &&
            a.AppointmentDate.Date == date.Date &&
            (!excludeAppointmentId.HasValue || a.Id != excludeAppointmentId.Value) &&
            a.Status != AppointmentStatus.Cancelled &&           // نوبت لغو نشده باشه
            a.StartTime < endTime && a.EndTime > startTime, ct); // زمان‌ها با هم تداخل دارن؟

    // ─── گرفتن نوبت‌ها با صفحه‌بندی و فیلتر ─────────────────
    // برای صفحه لیست نوبت‌ها در پنل ادمین
    // می‌شه فیلتر کرد: بر اساس دکتر، بیمار، وضعیت، بازه تاریخ
    // نتیجه: صفحه X از Y نوبت
    public async Task<(IEnumerable<Appointment> Items, int Total)> GetPagedAsync(
        Guid? doctorId, Guid? patientId, AppointmentStatus? status,
        DateTime? from, DateTime? to, int page, int pageSize, CancellationToken ct = default)
    {
        // کوئری پایه با جوین‌های لازم
        var query = _dbSet
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Include(a => a.Doctor)
            .AsQueryable();

        // فیلترهای اختیاری - هر کدوم که داده شده اعمال می‌کنیم
        if (doctorId.HasValue) query = query.Where(a => a.DoctorId == doctorId);
        if (patientId.HasValue) query = query.Where(a => a.PatientId == patientId);
        if (status.HasValue) query = query.Where(a => a.Status == status);
        if (from.HasValue) query = query.Where(a => a.AppointmentDate.Date >= from.Value.Date);
        if (to.HasValue) query = query.Where(a => a.AppointmentDate.Date <= to.Value.Date);

        // اول کل تعداد رو بشمار (برای نمایش "صفحه ۱ از ۵")
        var total = await query.CountAsync(ct);

        // بعد داده‌های صفحه X رو بگیر
        var items = await query
            .OrderByDescending(a => a.AppointmentDate)           // جدیدترین اول
            .Skip((page - 1) * pageSize)                         // صفحات قبلی رو رد کن
            .Take(pageSize)                                       // فقط تعداد مشخص بگیر
            .ToListAsync(ct);

        return (items, total);
    }
}
