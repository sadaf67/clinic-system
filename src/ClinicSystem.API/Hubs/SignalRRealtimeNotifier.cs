// ══════════════════════════════════════════════════════════════
// SignalRRealtimeNotifier — پیاده‌سازی واقعی IRealtimeNotifier
//
// این کلاس همون Interface ای رو پیاده‌سازی می‌کنه که لایه
// Application تعریف کرده (IRealtimeNotifier)، ولی چون از
// IHubContext<ConsultationHub> استفاده می‌کنه (یه چیز مخصوص
// ASP.NET Core SignalR)، باید توی لایه API باشه، نه Application.
//
// چرا از همون ConsultationHub استفاده می‌کنیم و Hub جدید نمی‌سازیم؟
// ConsultationHub از قبل توی OnConnectedAsync هر کاربر لاگین‌شده
// رو به گروه شخصی‌اش ("user_{userId}") اضافه می‌کنه. پس یه اتصال
// WebSocket واحد هم برای چت مشاوره و هم برای اعلان‌های لحظه‌ای
// کافیه — فرانت لازم نیست دو تا connection جدا نگه داره.
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.Interfaces.Services;
using Microsoft.AspNetCore.SignalR;

namespace ClinicSystem.API.Hubs;

public class SignalRRealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<ConsultationHub> _hub;

    public SignalRRealtimeNotifier(IHubContext<ConsultationHub> hub) => _hub = hub;

    // "ReceiveNotification" = نام رویدادی که فرانت گوشش رو می‌گیره
    // فقط به گروه شخصی همون کاربر می‌فرستیم، نه به همه (Broadcast)
    public Task NotifyUserAsync(Guid userId, object payload, CancellationToken ct = default) =>
        _hub.Clients.Group($"user_{userId}").SendAsync("ReceiveNotification", payload, ct);
}
