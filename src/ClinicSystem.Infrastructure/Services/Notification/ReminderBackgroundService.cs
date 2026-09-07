// ══════════════════════════════════════════════════════════════
// این سرویس "پشت صحنه" کار می‌کنه - مثل یه کارمند شب‌کار!
// هر روز ساعت ۸ صبح اتوماتیک بیدار میشه و نوبت‌های فردا رو چک می‌کنه
// برای نوبت‌هایی که هنوز یادآور نگرفتن، پیامک/تلگرام میفرسته
// BackgroundService یعنی همزمان با برنامه اصلی داره اجرا میشه (در پس‌زمینه)
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Application.Interfaces.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ClinicSystem.Infrastructure.Services.Notification;

public class ReminderBackgroundService : BackgroundService
{
    // IServiceScopeFactory برای ساختن یه "محیط" موقت هست
    // چون این سرویس همیشه زنده‌ست ولی DbContext باید موقتی باشه
    private readonly IServiceScopeFactory _scopeFactory;

    // برای لاگ کردن پیام‌ها در کنسول/فایل لاگ
    private readonly ILogger<ReminderBackgroundService> _logger;

    // ساعت اجرای روزانه: ۸ صبح
    private static readonly TimeOnly RunAt = new(8, 0);

    public ReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<ReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    // این متد وقتی برنامه شروع میشه اجرا میشه و تا برنامه زنده‌ست اجرا می‌مونه
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Reminder background service started.");

        // این حلقه تا وقتی برنامه داره کار می‌کنه ادامه داره
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;

            // حساب کن تا ساعت ۸ صبح بعدی چقدر مونده
            // اگه الان بعد از ۸ صبح هست، ساعت ۸ فردا رو حساب کن
            var nextRun = now.Date.AddDays(now.TimeOfDay > RunAt.ToTimeSpan() ? 1 : 0)
                              .Add(RunAt.ToTimeSpan());
            var delay = nextRun - now; // چقدر صبر کنیم

            _logger.LogInformation("Next reminder run at {NextRun}", nextRun);

            // صبر کن تا موقع اجرا برسه (بخواب!)
            await Task.Delay(delay, stoppingToken);

            // اگه برنامه داره بسته میشه، از حلقه خارج شو
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                // یه محیط موقت بساز برای استفاده از سرویس‌ها
                // (چون این سرویس Singleton هست ولی NotificationService Scoped هست)
                using var scope = _scopeFactory.CreateScope();
                var notifService = scope.ServiceProvider.GetRequiredService<INotificationService>();

                // برو نوبت‌های فردا رو پیدا کن و یادآور بفرست
                await notifService.ProcessPendingRemindersAsync(stoppingToken);

                _logger.LogInformation("Reminder processing completed at {Time}", DateTime.Now);
            }
            catch (Exception ex)
            {
                // اگه خطایی بود، لاگ کن ولی کرش نکن - فردا دوباره امتحان می‌کنیم
                _logger.LogError(ex, "Error during reminder processing.");
            }
        }
    }
}
