// ══════════════════════════════════════════════════════════════
// ConsultationHub — هاب SignalR برای چت آنلاین
//
// SignalR یه تکنولوژی مایکروسافته که اجازه میده
// سرور و کلاینت (مرورگر) پیام‌های دوطرفه بفرستن
// بدون اینکه کاربر صفحه رو رفرش کنه.
// مثل: واتساپ وب، Google Docs real-time و...
//
// این Hub مسئول چت بین بیمار و دکتر توی مشاوره آنلاین هست.
//
// مفهوم Group در SignalR:
// هر مشاوره یه "اتاق" مجازی داره (Group).
// وقتی میری توی یه مشاوره، به اون اتاق join میکنی.
// هر پیامی توی اون اتاق فرستاده بشه، همه اعضاش میبینن.
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ClinicSystem.API.Hubs;

// [Authorize] = فقط کاربران لاگین‌شده می‌تونن به این Hub وصل بشن
[Authorize]
public class ConsultationHub : Hub
{
    private readonly IGenericRepository<ConsultationMessage> _msgRepo;            // ریپازیتوری پیام‌ها
    private readonly IGenericRepository<OnlineConsultation> _consultationRepo;    // ریپازیتوری مشاوره‌ها
    private readonly IPatientRepository _patientRepo;

    public ConsultationHub(
        IGenericRepository<ConsultationMessage> msgRepo,
        IGenericRepository<OnlineConsultation> consultationRepo,
        IPatientRepository patientRepo)
    {
        _msgRepo = msgRepo;
        _consultationRepo = consultationRepo;
        _patientRepo = patientRepo;
    }

    // ──────────────────────────────────────────────────────────────
    // OnConnectedAsync: وقتی کاربر به SignalR وصل میشه
    //
    // هر کاربر لاگین‌شده به یه Group خصوصی به نام "user_{userId}"
    // اضافه میشه. این امکان میده که بهش نوتیفیکیشن شخصی بفرستیم.
    // ──────────────────────────────────────────────────────────────
    public override async Task OnConnectedAsync()
    {
        // شناسه کاربر رو از توکن JWT می‌خونه
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (userId != null)
        {
            // هر کاربر به یه گروه شخصی اضافه میشه
            // Context.ConnectionId = شناسه یکتا این اتصال WebSocket
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        await base.OnConnectedAsync(); // متد پایه رو هم صدا بزن
    }

    // ──────────────────────────────────────────────────────────────
    // JoinConsultation: ورود به اتاق چت یه مشاوره خاص
    //
    // وقتی کاربر صفحه چت رو باز می‌کنه، این متد صدا زده میشه.
    // از اینجا به بعد، پیام‌های این مشاوره رو می‌بینه.
    // ──────────────────────────────────────────────────────────────
    public async Task JoinConsultation(string consultationId)
    {
        var consultation = await GetAuthorizedConsultationAsync(consultationId);
        // اضافه کردن این connection به گروه "consultation_{id}"
        await Groups.AddToGroupAsync(Context.ConnectionId, $"consultation_{consultation.Id}");
    }

    // ──────────────────────────────────────────────────────────────
    // LeaveConsultation: خروج از اتاق چت
    //
    // وقتی کاربر صفحه رو میبنده، این متد صدا زده میشه.
    // ──────────────────────────────────────────────────────────────
    public async Task LeaveConsultation(string consultationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"consultation_{consultationId}");
    }

    // ──────────────────────────────────────────────────────────────
    // SendMessage: ارسال پیام چت
    //
    // این متد از طرف کاربر (frontend) صدا زده میشه.
    // کار این متد:
    // ۱. پیام رو توی دیتابیس ذخیره کن
    // ۲. پیام رو به همه اعضای اتاق بفرست (از جمله خود فرستنده)
    // ──────────────────────────────────────────────────────────────
    public async Task SendMessage(string consultationId, string content)
    {
        var consultation = await GetAuthorizedConsultationAsync(consultationId);
        var normalizedContent = content?.Trim();
        if (string.IsNullOrEmpty(normalizedContent))
            throw new HubException("Message cannot be empty.");
        if (normalizedContent.Length > 4000)
            throw new HubException("Message is too long.");

        // اطلاعات فرستنده رو از توکن JWT می‌خونه
        var principal = Context.User ?? throw new HubException("Authentication required.");
        var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
            throw new HubException("Invalid user identity.");

        var isDoctor   = principal.IsInRole("SuperAdmin") || principal.IsInRole("Admin");
        var senderName = principal.FindFirstValue("fullName") ?? "Unknown"; // نام کامل از Claim

        // ساختن آبجکت پیام
        var message = new ConsultationMessage
        {
            ConsultationId = consultation.Id,
            SenderId       = userId,
            SenderName     = senderName,
            IsDoctor       = isDoctor, // true = دکتر فرستاده، false = بیمار
            Content        = normalizedContent,
            SentAt         = DateTime.UtcNow
        };

        // ذخیره در دیتابیس (برای تاریخچه)
        await _msgRepo.AddAsync(message);
        await _msgRepo.SaveChangesAsync();

        // ارسال به همه اعضای اتاق از طریق SignalR
        // "ReceiveMessage" = نام رویدادی که frontend گوشش رو میکشه
        await Clients.Group($"consultation_{consultation.Id}").SendAsync("ReceiveMessage", new
        {
            id         = message.Id,
            senderId   = userId,
            senderName,
            isDoctor,
            content = normalizedContent,
            sentAt     = message.SentAt
        });
    }

    public async Task MarkMessagesRead(string consultationId)
    {
        var consultation = await GetAuthorizedConsultationAsync(consultationId);
        var principal = Context.User ?? throw new HubException("Authentication required.");
        var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
            throw new HubException("Invalid user identity.");

        var unreadMessages = await _msgRepo.FindAsync(
            m => m.ConsultationId == consultation.Id &&
                 m.SenderId != userId &&
                 !m.IsRead,
            Context.ConnectionAborted);

        foreach (var message in unreadMessages)
        {
            message.IsRead = true;
            message.SetUpdated();
            _msgRepo.Update(message);
        }

        if (unreadMessages.Any())
            await _msgRepo.SaveChangesAsync(Context.ConnectionAborted);

        await Clients.Group($"consultation_{consultation.Id}")
            .SendAsync("MessagesRead", userId, Context.ConnectionAborted);
    }

    private async Task<OnlineConsultation> GetAuthorizedConsultationAsync(string consultationId)
    {
        if (!Guid.TryParse(consultationId, out var id))
            throw new HubException("Invalid consultation id.");

        var consultation = await _consultationRepo.GetByIdAsync(id, Context.ConnectionAborted)
            ?? throw new HubException("Consultation not found.");

        var principal = Context.User ?? throw new HubException("Authentication required.");
        if (principal.IsInRole("SuperAdmin") || principal.IsInRole("Admin"))
            return consultation;

        var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwner = Guid.TryParse(userIdValue, out var userId) &&
            await _patientRepo.AnyAsync(
                p => p.Id == consultation.PatientId && p.UserId == userId,
                Context.ConnectionAborted);

        if (!isOwner) throw new HubException("Access denied.");
        return consultation;
    }

}
