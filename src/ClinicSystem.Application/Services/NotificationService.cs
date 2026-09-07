// ══════════════════════════════════════════════════════════════
// NotificationService — سرویس ارسال اطلاعیه
//
// این سرویس مسئول ارسال نوتیفیکیشن‌ها به بیماران هست.
// هر نوتیفیکیشن از ۳ کانال (یا هر کدام که فعاله) ارسال میشه:
//
// ۱. داخل برنامه (InApp): همیشه ارسال میشه — بدون شرط
// ۲. پیامک (SMS): فقط اگه بیمار گزینه "اطلاع‌رسانی SMS" رو
//    فعال کرده باشه (NotifyViaSms = true)
// ۳. تلگرام: فقط اگه ChatId تلگرام داشته باشه و فعال باشه
//
// رویدادهایی که نوتیفیکیشن ارسال میشن:
// - تأیید نوبت جدید
// - لغو نوبت
// - یادآوری نوبت (یک روز قبل)
// - پاسخ مشاوره آنلاین
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ClinicSystem.Application.Services;

public class NotificationService : INotificationService
{
    // سرویس‌های ارسال پیام
    // ریپازیتوری‌های دیتابیس
    private readonly IAppointmentRepository _appointmentRepo;       // نوبت‌ها
    private readonly IGenericRepository<Notification> _notifRepo;   // اعلان‌ها
    private readonly IGenericRepository<OutboxMessage> _outboxRepo;
    private readonly IRealtimeNotifier _realtimeNotifier;           // پوش لحظه‌ای (SignalR)

    // لاگر برای ثبت خطاها
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IAppointmentRepository appointmentRepo,
        IGenericRepository<Notification> notifRepo,
        IGenericRepository<OutboxMessage> outboxRepo,
        IRealtimeNotifier realtimeNotifier,
        ILogger<NotificationService> logger)
    {
        _appointmentRepo = appointmentRepo;
        _notifRepo = notifRepo;
        _outboxRepo = outboxRepo;
        _realtimeNotifier = realtimeNotifier;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────────────
    // PushRealtimeAsync: پوش یه اعلان به کاربری که همون لحظه آنلاینه
    //
    // شکل payload دقیقاً هم‌شکل خروجی GET /api/notifications هست
    // تا فرانت بتونه بدون تبدیل جداگانه مستقیم بالای لیست اضافه‌اش کنه.
    // اگه کاربر آنلاین نباشه (به گروه SignalR وصل نباشه)، این پیام
    // گم میشه — ولی چون رکورد توی دیتابیس هم ذخیره شده، با اولین
    // درخواست GET بعدی (یا رفرش صفحه) عادی نمایش داده میشه.
    // خطای SignalR (مثلاً قطعی موقت) نباید باعث شکست کل عملیات بشه،
    // پس اینجا catch می‌کنیم و فقط لاگ می‌زنیم.
    // ──────────────────────────────────────────────────────────────
    private async Task PushRealtimeAsync(Notification notif, CancellationToken ct)
    {
        try
        {
            await _realtimeNotifier.NotifyUserAsync(notif.UserId, new
            {
                notif.Id,
                notif.Type,
                notif.Status,
                notif.Title,
                notif.TitleEn,
                notif.Message,
                notif.MessageEn,
                notif.IsRead,
                notif.SentAt,
                notif.RelatedEntityId,
                notif.RelatedEntityType,
                notif.CreatedAt
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Realtime push failed for notification {Id}", notif.Id);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // SendAppointmentReminderAsync: یادآوری نوبت
    //
    // این متد از طریق ReminderBackgroundService هر روز ساعت ۸
    // برای نوبت‌های فردا صدا زده میشه.
    //
    // بعد از ارسال، ReminderSent = true میشه تا دوباره
    // یادآوری نفرسته.
    // ──────────────────────────────────────────────────────────────
    public async Task SendAppointmentReminderAsync(Appointment appointment, CancellationToken ct = default)
    {
        var user = appointment.Patient?.User;
        if (user == null) return; // اگه اطلاعات کاربر نداره، برگرد

        var dateStr = appointment.AppointmentDate.ToString("yyyy/MM/dd");
        var timeStr = appointment.StartTime.ToString(@"hh\:mm");

        // متن پیامک فارسی
        var msgFa = $"یادآوری نوبت\nبیمار گرامی {user.FullName},\n" +
                    $"نوبت شما فردا {dateStr} ساعت {timeStr} می‌باشد.\n" +
                    $"لطفاً ۱۵ دقیقه قبل حضور داشته باشید.";

        // متن پیامک انگلیسی
        var msgEn = $"Appointment Reminder\nDear {user.FullNameEn},\n" +
                    $"Your appointment is tomorrow {dateStr} at {timeStr}.\n" +
                    $"Please arrive 15 minutes early.";

        // ارسال از همه کانال‌های فعال
        await SendToUserAsync(user, "یادآوری نوبت", "Appointment Reminder",
            msgFa, msgEn, appointment.Id, ct);

        // علامت زدن: یادآوری فرستاده شد
        appointment.ReminderSent   = true;
        appointment.ReminderSentAt = DateTime.UtcNow;
        _appointmentRepo.Update(appointment);
        await _appointmentRepo.SaveChangesAsync(ct);
    }

    // ──────────────────────────────────────────────────────────────
    // SendAppointmentConfirmationAsync: تأیید ثبت نوبت
    //
    // بلافاصله بعد از ثبت نوبت صدا زده میشه.
    // اگه آنلاین هست، لینک ویدیوکنفرانس هم توی پیام هست.
    // ──────────────────────────────────────────────────────────────
    public async Task SendAppointmentConfirmationAsync(Appointment appointment, CancellationToken ct = default)
    {
        var user = appointment.Patient?.User;
        if (user == null) return;

        var dateStr = appointment.AppointmentDate.ToString("yyyy/MM/dd");
        var timeStr = appointment.StartTime.ToString(@"hh\:mm");
        var typeFa  = appointment.Type == AppointmentType.Online ? "آنلاین" : "حضوری";

        var msgFa = $"تأیید نوبت\nنوبت {typeFa} شما برای {dateStr} ساعت {timeStr} با موفقیت ثبت شد.";

        // اضافه کردن لینک ویدیوکنفرانس اگه آنلاینه
        if (appointment.MeetingLink != null)
            msgFa += $"\nلینک ویزیت آنلاین: {appointment.MeetingLink}";

        var msgEn = $"Appointment Confirmed\n" +
                    $"Your {appointment.Type} appointment on {dateStr} at {timeStr} has been confirmed.";

        await SendToUserAsync(user, "تأیید نوبت", "Appointment Confirmed",
            msgFa, msgEn, appointment.Id, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // SendAppointmentCancellationAsync: لغو نوبت
    // ──────────────────────────────────────────────────────────────
    public async Task SendAppointmentCancellationAsync(Appointment appointment, CancellationToken ct = default)
    {
        var user = appointment.Patient?.User;
        if (user == null) return;

        var dateStr = appointment.AppointmentDate.ToString("yyyy/MM/dd");

        var msgFa = $"لغو نوبت\nنوبت شما در تاریخ {dateStr} لغو شد. " +
                    $"جهت رزرو مجدد با ما تماس بگیرید.";
        var msgEn = $"Appointment Cancelled\nYour appointment on {dateStr} has been cancelled. " +
                    $"Please contact us to reschedule.";

        await SendToUserAsync(user, "لغو نوبت", "Appointment Cancelled",
            msgFa, msgEn, appointment.Id, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // SendConsultationReplyAsync: پاسخ مشاوره آنلاین
    //
    // وقتی دکتر به سؤال بیمار جواب میده، این متد صدا میشه.
    // ──────────────────────────────────────────────────────────────
    public async Task SendConsultationReplyAsync(OnlineConsultation consultation, CancellationToken ct = default)
    {
        var user = consultation.Patient?.User;
        if (user == null) return;

        var msgFa = "پزشک به مشاوره آنلاین شما پاسخ داد. برای مشاهده پاسخ وارد پنل خود شوید.";
        var msgEn = "Your online consultation has been answered. Log in to your panel to view the response.";

        await SendToUserAsync(user, "پاسخ مشاوره", "Consultation Reply",
            msgFa, msgEn, consultation.Id, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // SendCustomNotificationAsync: ارسال نوتیفیکیشن دلخواه
    //
    // برای ارسال دستی یه پیام به یه کاربر مشخص
    // ──────────────────────────────────────────────────────────────
    public async Task SendCustomNotificationAsync(Guid userId, string titleFa, string titleEn,
        string messageFa, string messageEn, CancellationToken ct = default)
    {
        var notif = new Notification
        {
            UserId   = userId,
            Type     = NotificationType.InApp,
            Status   = NotificationStatus.Sent,
            Title    = titleFa,
            TitleEn  = titleEn,
            Message  = messageFa,
            MessageEn= messageEn,
            SentAt   = DateTime.UtcNow
        };
        await _notifRepo.AddAsync(notif, ct);
        await _notifRepo.SaveChangesAsync(ct);
        await PushRealtimeAsync(notif, ct);
    }

    // ──────────────────────────────────────────────────────────────
    // ProcessPendingRemindersAsync: پردازش یادآوری‌های در انتظار
    //
    // این متد توسط ReminderBackgroundService هر صبح صدا میشه.
    // همه نوبت‌هایی که یادآوری نگرفتن رو پیدا می‌کنه و
    // یادآوری میفرسته. اگه خطا بخوره، ادامه میده (تا یه نوبت
    // باعث نشه بقیه یادآوری نگیرن)
    // ──────────────────────────────────────────────────────────────
    public async Task ProcessPendingRemindersAsync(CancellationToken ct = default)
    {
        var pendingReminders = await _appointmentRepo.GetPendingRemindersAsync(ct);

        foreach (var appointment in pendingReminders)
        {
            try
            {
                await SendAppointmentReminderAsync(appointment, ct);
                _logger.LogInformation("Reminder sent for appointment {Id}", appointment.Id);
            }
            catch (Exception ex)
            {
                // خطا رو لاگ کن ولی ادامه بده — یه نوبت خراب، بقیه رو خراب نکنه
                _logger.LogError(ex, "Failed to send reminder for appointment {Id}", appointment.Id);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────
    // SendToUserAsync: متد خصوصی — ارسال از همه کانال‌های فعال
    //
    // این متد اصلی هست که همه متدهای بالا ازش استفاده می‌کنن.
    // ترتیب ارسال:
    // ۱. InApp (همیشه) ← ذخیره در دیتابیس
    // ۲. SMS (اگه فعال باشه) ← از کاوه‌نگار
    // ۳. Telegram (اگه ChatId داشته باشه و فعال باشه)
    //
    // هر کانال رکورد جداگانه توی Notifications ذخیره میشه
    // با وضعیت Sent یا Failed
    // ──────────────────────────────────────────────────────────────
    private async Task SendToUserAsync(
        ApplicationUser user, string titleFa, string titleEn,
        string msgFa, string msgEn, Guid relatedId, CancellationToken ct)
    {
        // ── کانال ۱: اعلان داخل برنامه (همیشه) ────────────────
        var notif = new Notification
        {
            UserId          = user.Id,
            Type            = NotificationType.InApp,
            Status          = NotificationStatus.Sent,
            Title           = titleFa,
            TitleEn         = titleEn,
            Message         = msgFa,
            MessageEn       = msgEn,
            RelatedEntityId = relatedId,
            SentAt          = DateTime.UtcNow
        };
        await _notifRepo.AddAsync(notif, ct);

        // ── کانال ۲: SMS (فقط اگه فعال باشه) ──────────────────
        if (user.NotifyViaSms && !string.IsNullOrEmpty(user.PhoneNumber))
            await QueueChannelAsync(user.Id, NotificationType.SMS, user.PhoneNumber,
                titleFa, titleEn, msgFa, msgEn, relatedId, ct);

        // ── کانال ۳: تلگرام (فقط اگه ChatId داشته باشه) ───────
        if (user.NotifyViaTelegram && !string.IsNullOrEmpty(user.TelegramChatId))
            await QueueChannelAsync(user.Id, NotificationType.Telegram, user.TelegramChatId,
                titleFa, titleEn, msgFa, msgEn, relatedId, ct);

        if (user.NotifyViaWhatsApp && !string.IsNullOrEmpty(user.PhoneNumber))
            await QueueChannelAsync(user.Id, NotificationType.WhatsApp, user.PhoneNumber,
                titleFa, titleEn, msgFa, msgEn, relatedId, ct);

        // همه رکوردها رو یه‌جا ذخیره کن (بهینه‌تر از چندین SaveChanges)
        await _notifRepo.SaveChangesAsync(ct);

        // فقط اعلان داخل‌برنامه‌ای رو لحظه‌ای پوش کن (SMS/تلگرام از طریق Outbox پردازش میشن)
        await PushRealtimeAsync(notif, ct);
    }

    private async Task QueueChannelAsync(
        Guid userId, NotificationType type, string destination,
        string titleFa, string titleEn, string msgFa, string msgEn,
        Guid relatedId, CancellationToken ct)
    {
        var notification = CreateNotif(userId, type, titleFa, titleEn, msgFa, msgEn, relatedId);
        await _notifRepo.AddAsync(notification, ct);
        var payload = JsonSerializer.Serialize(new OutboxNotificationPayload(
            notification.Id, type, destination, msgFa));
        await _outboxRepo.AddAsync(new OutboxMessage
        {
            EventType = "SendNotification",
            PayloadJson = payload,
            IdempotencyKey = $"notification:{notification.Id}",
            AvailableAt = DateTime.UtcNow,
            MaxAttempts = 5
        }, ct);
    }

    private sealed record OutboxNotificationPayload(
        Guid NotificationId, NotificationType Type, string Destination, string Message);

    // ──────────────────────────────────────────────────────────────
    // CreateNotif: متد کمکی — ساختن یه آبجکت Notification
    // برای کانال‌های مختلف (SMS، تلگرام و...) استفاده میشه
    // ──────────────────────────────────────────────────────────────
    private static Notification CreateNotif(
        Guid userId, NotificationType type,
        string titleFa, string titleEn,
        string msgFa, string msgEn, Guid relatedId) => new()
    {
        UserId          = userId,
        Type            = type,                    // SMS، Telegram، InApp
        Status          = NotificationStatus.Pending, // در حال ارسال
        Title           = titleFa,
        TitleEn         = titleEn,
        Message         = msgFa,
        MessageEn       = msgEn,
        RelatedEntityId = relatedId
    };
}
