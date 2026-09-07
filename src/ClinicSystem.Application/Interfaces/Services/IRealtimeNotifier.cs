// ══════════════════════════════════════════════════════════════
// IRealtimeNotifier — پل ارتباطی به لایه‌ی real-time (SignalR)
//
// چرا این Interface لازم بود؟
// NotificationService (لایه Application) نباید مستقیم به SignalR
// یا هر تکنولوژی وب دیگه‌ای وابسته باشه — این‌ها جزئیات لایه
// API/Infrastructure هستن. طبق معماری تمیز (Clean Architecture)،
// لایه Application فقط این Interface رو می‌شناسه؛ پیاده‌سازی
// واقعی (که از IHubContext<ConsultationHub> استفاده می‌کنه) توی
// پروژه API نوشته و در DI ثبت میشه.
//
// نتیجه: وقتی یه اعلان جدید ساخته میشه، اگه کاربر همون لحظه
// توی سایت آنلاین باشه (تب باز باشه)، بدون رفرش یا polling
// دوره‌ای فوراً می‌بینتش.
// ══════════════════════════════════════════════════════════════
namespace ClinicSystem.Application.Interfaces.Services;

public interface IRealtimeNotifier
{
    // payload = آبجکتی که مستقیم به فرانت به شکل JSON فرستاده میشه
    // (باید هم‌شکل با خروجی GET /api/notifications باشه تا فرانت
    // بتونه بدون تغییر مستقیم به لیست اضافه‌اش کنه)
    Task NotifyUserAsync(Guid userId, object payload, CancellationToken ct = default);
}
