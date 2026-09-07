// ══════════════════════════════════════════════════════════════
// PagedResult — کلاس نتیجه صفحه‌بندی‌شده
//
// وقتی از API لیست می‌گیریم، به جای برگردوندن همه رکوردها
// (که ممکنه هزاران تا باشه)، فقط یه صفحه میدیم.
//
// مثل Google: ۱۰ نتیجه در هر صفحه، و یه نوار صفحه‌بندی.
//
// T = نوع داده — هر کلاسی می‌تونه اینجا استفاده بشه
// مثال: PagedResult<AppointmentDto>
//       PagedResult<PatientDto>
// ══════════════════════════════════════════════════════════════

namespace ClinicSystem.Application.DTOs.Appointment;

public class PagedResult<T>
{
    // لیست آیتم‌های این صفحه (مثلاً ۲۰ نوبت از ۱۵۰ نوبت)
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();

    // تعداد کل رکوردها در دیتابیس (مثلاً ۱۵۰)
    public int Total { get; set; }

    // شماره صفحه فعلی (۱ به بعد)
    public int Page { get; set; }

    // تعداد آیتم در هر صفحه (مثلاً ۲۰)
    public int PageSize { get; set; }

    // تعداد کل صفحه‌ها — خودکار محاسبه میشه
    // مثال: 150 آیتم / 20 آیتم در صفحه = 8 صفحه (گرد به بالا)
    public int TotalPages => (int)Math.Ceiling((double)Total / PageSize);

    // آیا صفحه بعدی وجود داره؟ (برای دکمه "بعدی")
    public bool HasNext => Page < TotalPages;

    // آیا صفحه قبلی وجود داره؟ (برای دکمه "قبلی")
    public bool HasPrev => Page > 1;
}
