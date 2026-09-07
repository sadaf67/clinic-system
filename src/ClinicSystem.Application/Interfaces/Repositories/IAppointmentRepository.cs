// ══════════════════════════════════════════════════════════════
// IAppointmentRepository — اینترفیس تخصصی نوبت‌ها
//
// این اینترفیس علاوه بر عملیات عمومی IGenericRepository،
// متدهای مخصوص نوبت‌ها رو هم داره.
//
// وراثت: IAppointmentRepository از IGenericRepository<Appointment>
// ارث میبره — یعنی همه متدهای عمومی رو هم داره.
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Application.Interfaces.Repositories;

// این اینترفیس از IGenericRepository ارث میبره
// پس GetByIdAsync، FindAsync و... رو هم داره
public interface IAppointmentRepository : IGenericRepository<Appointment>
{
    // ── متدهای تخصصی نوبت‌ها ─────────────────────────────────

    // همه نوبت‌های یه بیمار مشخص
    Task<IEnumerable<Appointment>> GetByPatientIdAsync(
        Guid patientId, CancellationToken ct = default);

    Task<Appointment?> GetWithDetailsAsync(Guid id, CancellationToken ct = default);

    // نوبت‌های یه دکتر — اگه date داده بشه، فیلتر روز میشه
    Task<IEnumerable<Appointment>> GetByDoctorIdAsync(
        Guid doctorId, DateTime? date = null, CancellationToken ct = default);

    // نوبت‌هایی که باید یادآوری بفرستیم
    // (فردا نوبت دارن و هنوز یادآوری نفرستادیم)
    Task<IEnumerable<Appointment>> GetPendingRemindersAsync(CancellationToken ct = default);

    // نوبت‌های یه بازه تاریخی مشخص (برای نمودار هفتگی)
    Task<IEnumerable<Appointment>> GetByDateRangeAsync(
        DateTime start, DateTime end, CancellationToken ct = default);

    // آیا این تایم اسلات آزاده؟
    // doctorId = شناسه دکتر
    // date = تاریخ
    // startTime/endTime = شروع و پایان نوبت
    Task<bool> IsSlotAvailableAsync(
        Guid doctorId, DateTime date, TimeSpan startTime, TimeSpan endTime,
        Guid? excludeAppointmentId = null,
        CancellationToken ct = default);

    // گرفتن نوبت‌ها با صفحه‌بندی و فیلترهای مختلف
    // Items = لیست نوبت‌ها، Total = تعداد کل (برای pagination)
    Task<(IEnumerable<Appointment> Items, int Total)> GetPagedAsync(
        Guid? doctorId,              // فیلتر بر اساس دکتر (اختیاری)
        Guid? patientId,             // فیلتر بر اساس بیمار (اختیاری)
        AppointmentStatus? status,   // فیلتر وضعیت (اختیاری)
        DateTime? from,              // از تاریخ (اختیاری)
        DateTime? to,                // تا تاریخ (اختیاری)
        int page, int pageSize,      // صفحه‌بندی
        CancellationToken ct = default);
}
