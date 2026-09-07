// ══════════════════════════════════════════════════════════════
// NotificationsController — کنترلر اعلان‌ها
//
// اعلان‌ها (Notifications) یعنی همون پیغام‌هایی که گوشه‌ی
// صفحه بهت نشون داده میشه — مثل:
// "نوبت شما تأیید شد" یا "جواب مشاوره شما آماده‌ست"
//
// هر کاربر فقط اعلان‌های خودش رو می‌تونه ببینه.
//
// دسترسی: همه لاگین‌شده‌ها
// آدرس‌ها:
//   GET    /api/notifications          — گرفتن لیست اعلان‌ها
//   PATCH  /api/notifications/{id}/read — خوانده‌شده کردن یه اعلان
//   PATCH  /api/notifications/read-all  — خوانده‌شده کردن همه
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ClinicSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // هر کاربر لاگین‌شده‌ای می‌تونه اعلان‌هاش رو ببینه
public class NotificationsController : ControllerBase
{
    // ریپازیتوری اعلان‌ها
    private readonly IGenericRepository<Notification> _repo;

    // سازنده — ریپازیتوری از طریق DI تزریق میشه
    public NotificationsController(IGenericRepository<Notification> repo) => _repo = repo;

    // ──────────────────────────────────────────────────────────────
    // GetAll: گرفتن لیست اعلان‌های کاربر لاگین‌شده
    // آدرس: GET /api/notifications
    //
    // پارامترهای اختیاری:
    // unreadOnly: true = فقط اعلان‌های خوانده‌نشده
    // page, pageSize: برای صفحه‌بندی
    //
    // خروجی: { items, total, unreadCount, page, pageSize }
    // ──────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool? unreadOnly,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        // شناسه کاربر لاگین‌شده رو از توکن می‌خونه
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // گرفتن اعلان‌های این کاربر
        // اگه unreadOnly = true بود، فقط خوانده‌نشده‌ها رو میده
        var all = await _repo.FindAsync(n =>
            n.UserId == userId &&
            (!unreadOnly.HasValue || !unreadOnly.Value || !n.IsRead), ct);

        var total = all.Count(); // تعداد کل

        // صفحه‌بندی: Skip = بپر از مواردی که قبل از این صفحه هستن
        var items = all.OrderByDescending(n => n.CreatedAt)       // جدیدترین اول
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id, n.Type, n.Status,
                n.Title, n.TitleEn,       // عنوان فارسی و انگلیسی
                n.Message, n.MessageEn,   // متن فارسی و انگلیسی
                n.IsRead,                 // آیا خونده شده؟
                n.SentAt,
                n.RelatedEntityId,        // شناسه موضوع (مثلاً Id نوبت)
                n.RelatedEntityType,      // نوع موضوع ("Appointment"، "Consultation" و...)
                n.CreatedAt
            });

        // تعداد خوانده‌نشده‌ها (برای نشون دادن badge قرمز روی آیکون زنگ)
        var unreadCount = all.Count(n => !n.IsRead);

        return Ok(new { items, total, unreadCount, page, pageSize });
    }

    // ──────────────────────────────────────────────────────────────
    // MarkRead: خوانده‌شده کردن یه اعلان مشخص
    // آدرس: PATCH /api/notifications/{id}/read
    //
    // یه چک امنیتی داره: مطمئن میشه اعلان مال همین کاربر هست
    // (نه کاربر دیگه‌ای) قبل از اینکه آپدیتش کنه
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var notif = await _repo.GetByIdAsync(id, ct);

        // اگه پیدا نشد یا مال این کاربر نیست → ۴۰۴
        if (notif == null || notif.UserId != userId) return NotFound();

        notif.IsRead = true; // خوانده‌شده علامت بزن
        _repo.Update(notif);
        await _repo.SaveChangesAsync(ct);

        return NoContent(); // ۲۰۴ — موفق، محتوایی برنمیگردونه
    }

    // ──────────────────────────────────────────────────────────────
    // MarkAllRead: همه اعلان‌های خوانده‌نشده رو خوانده کن
    // آدرس: PATCH /api/notifications/read-all
    //
    // مثل دکمه "علامت‌گذاری همه به عنوان خوانده‌شده"
    // ──────────────────────────────────────────────────────────────
    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // همه اعلان‌های خوانده‌نشده این کاربر
        var unread = await _repo.FindAsync(n => n.UserId == userId && !n.IsRead, ct);

        // یه‌به‌یه خوانده‌شده کن
        foreach (var n in unread)
        {
            n.IsRead = true;
            _repo.Update(n);
        }

        await _repo.SaveChangesAsync(ct);
        return NoContent(); // ۲۰۴
    }
}
