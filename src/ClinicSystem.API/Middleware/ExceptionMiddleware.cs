// ══════════════════════════════════════════════════════════════
// ExceptionMiddleware — میانجی مدیریت خطاها
//
// میانجی (Middleware) یه لایه‌ی بینابینه که همه درخواست‌های HTTP
// قبل از رسیدن به کنترلر از اون رد میشن.
//
// این Middleware مثل یه "سپر" عمل می‌کنه:
// اگه هر جای برنامه یه خطای پیش‌بینی‌نشده بیفته،
// این کد اون رو می‌گیره و به جای نشون دادن خطای
// زشت C# به کاربر، یه پیغام خطای مرتب JSON برمیگردونه.
//
// بدون این Middleware، اگه خطایی بیفته، کاربر 500 Internal Server
// Error با متن انگلیسی می‌بینه. با این Middleware، پیغام فارسی
// و مناسب می‌بینه.
// ══════════════════════════════════════════════════════════════

using System.Net;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ClinicSystem.API.Middleware;

public class ExceptionMiddleware
{
    // _next: درخواست بعد از این Middleware کجا بره؟
    // (به Middleware بعدی یا خود کنترلر)
    private readonly RequestDelegate _next;

    // _logger: برای نوشتن خطاها توی لاگ‌های سرور
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────────────
    // InvokeAsync: این متد برای هر درخواست HTTP اجرا میشه
    //
    // try → درخواست رو به Middleware/کنترلر بعدی بفرست
    // catch → اگه خطایی بیفته، اون رو مدیریت کن
    // ──────────────────────────────────────────────────────────────
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // درخواست رو به بقیه pipeline بفرست
            await _next(context);
        }
        catch (Exception ex)
        {
            // خطا رو توی لاگ سرور بنویس (برای دیباگ)
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);

            // به کاربر یه پاسخ مرتب JSON بده
            await HandleExceptionAsync(context, ex);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // HandleExceptionAsync: تبدیل خطا به پاسخ HTTP مناسب
    //
    // نوع خطا                    → کد HTTP     → پیغام
    // ─────────────────────────────────────────────────────
    // KeyNotFoundException        → 404 Not Found
    // UnauthorizedAccessException → 401 Unauthorized
    // InvalidOperationException   → 400 Bad Request
    // هر خطای دیگه‌ای            → 500 Internal Server Error
    // ──────────────────────────────────────────────────────────────
    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        // pattern matching: بر اساس نوع خطا، کد و پیغام مناسب انتخاب کن
        var (statusCode, message) = exception switch
        {
            KeyNotFoundException        => (HttpStatusCode.NotFound,            exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized,         exception.Message),
            InvalidOperationException   => (HttpStatusCode.BadRequest,           exception.Message),
            ArgumentException           => (HttpStatusCode.BadRequest,           exception.Message),
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } }
                                        => (HttpStatusCode.Conflict, "رکورد دیگری با همین مشخصات وجود دارد."),
            // برای همه خطاهای ناشناخته — پیغام فارسی میده تا کاربر نگران نشه
            _                           => (HttpStatusCode.InternalServerError,  "خطای داخلی سرور. لطفاً دوباره تلاش کنید.")
        };

        // Content-Type = نوع پاسخ (JSON)
        context.Response.ContentType = "application/json";
        context.Response.StatusCode  = (int)statusCode;

        // ساختن JSON پاسخ خطا
        var result = JsonSerializer.Serialize(new
        {
            statusCode = (int)statusCode,
            message,
            timestamp  = DateTime.UtcNow // زمان وقوع خطا (مفید برای لاگ کلاینت)
        });

        // ارسال پاسخ به کاربر
        return context.Response.WriteAsync(result);
    }
}
