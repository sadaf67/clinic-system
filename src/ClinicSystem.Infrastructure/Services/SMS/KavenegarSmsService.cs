// ══════════════════════════════════════════════════════════════
// KavenegarSmsService — سرویس ارسال پیامک از طریق کاوه‌نگار
//
// کاوه‌نگار یه سرویس ایرانیه که از طریق API پیامک میفرسته.
// ما اینجا با HTTP به API کاوه‌نگار درخواست میفرستیم.
//
// تنظیمات در appsettings.json:
// "Kavenegar": {
//   "ApiKey": "کلید API از پنل کاوه‌نگار",
//   "Sender": "خط ارسال (مثلاً 2000660110911)"
// }
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace ClinicSystem.Infrastructure.Services.SMS;

public class KavenegarSmsService : ISmsService
{
    // HttpClient = ابزار ارسال درخواست HTTP به کاوه‌نگار
    private readonly HttpClient _httpClient;

    // ApiKey = کلید احراز هویت API کاوه‌نگار (از appsettings)
    private readonly string _apiKey;

    // Sender = شماره‌ای که پیامک ازش فرستاده میشه
    private readonly string _sender;

    private readonly ILogger<KavenegarSmsService> _logger;

    // آدرس پایه API کاوه‌نگار
    private const string BaseUrl = "https://api.kavenegar.com/v1";

    public KavenegarSmsService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<KavenegarSmsService> logger)
    {
        _httpClient = httpClient;
        // اگه ApiKey در appsettings نبود → خطا بده (سیستم بدون پیامک کار نکنه)
        _apiKey = config["Kavenegar:ApiKey"]
            ?? throw new InvalidOperationException("Kavenegar ApiKey not configured.");
        _sender = config["Kavenegar:Sender"] ?? "2000660110911";
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────────────
    // SendAsync: ارسال پیامک آزاد
    //
    // پارامترها:
    // mobile: شماره موبایل گیرنده (09xxxxxxxxx یا +98xxxxxxxxx)
    // message: متن پیامک
    //
    // خروجی: true = موفق، false = خطا
    //
    // API کاوه‌نگار: POST /v1/{apiKey}/sms/send.json
    // پاسخ: JSON با Status=200 اگه موفق بود
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendAsync(string mobile, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("SMS was not sent because Kavenegar:ApiKey is not configured.");
            return false;
        }

        try
        {
            // ساختن آدرس کامل API
            var url = $"{BaseUrl}/{_apiKey}/sms/send.json";

            // پارامترهای POST (form-encoded نه JSON)
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["receptor"] = NormalizeMobile(mobile),  // شماره گیرنده (نرمال‌شده)
                ["message"]  = message,                   // متن پیامک
                ["sender"]   = _sender                    // خط ارسال
            });

            // ارسال درخواست HTTP POST
            var response = await _httpClient.PostAsync(url, content, ct);
            var body     = await response.Content.ReadAsStringAsync(ct);

            // تجزیه پاسخ JSON کاوه‌نگار
            var result = JsonSerializer.Deserialize<KavenegarResponse>(body);

            if (result?.Return?.Status == 200)
            {
                _logger.LogInformation("SMS sent to {Mobile}", mobile);
                return true; // موفق
            }

            // API کاوه‌نگار پاسخ داد ولی موفق نبود
            _logger.LogWarning("SMS failed to {Mobile}: {Message}", mobile, result?.Return?.Message);
            return false;
        }
        catch (Exception ex)
        {
            // خطای شبکه یا غیرمنتظره
            _logger.LogError(ex, "SMS exception for {Mobile}", mobile);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // SendTemplateAsync: ارسال پیامک الگویی (تمپلیت)
    //
    // کاوه‌نگار قابلیت ارسال از روی قالب‌های از پیش تعریف‌شده
    // رو داره — مفید برای پیامک‌های OTP و تأیید.
    //
    // API: /v1/{apiKey}/verify/lookup.json
    // پارامترهای قالب با token، token2، token3 و... ارسال میشن
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendTemplateAsync(
        string mobile, string templateName,
        Dictionary<string, string> parameters,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("SMS template was not sent because Kavenegar:ApiKey is not configured.");
            return false;
        }

        try
        {
            var url = $"{BaseUrl}/{_apiKey}/verify/lookup.json";

            var dict = new Dictionary<string, string>
            {
                ["receptor"] = NormalizeMobile(mobile),
                ["template"] = templateName // نام قالب در پنل کاوه‌نگار
            };

            // اضافه کردن پارامترهای قالب
            // اولی: token، بقیه: token2، token3 و...
            int i = 1;
            foreach (var (key, value) in parameters)
            {
                dict[$"token{(i == 1 ? "" : i.ToString())}"] = value;
                i++;
            }

            var content  = new FormUrlEncodedContent(dict);
            var response = await _httpClient.PostAsync(url, content, ct);
            var body     = await response.Content.ReadAsStringAsync(ct);
            var result   = JsonSerializer.Deserialize<KavenegarResponse>(body);

            return result?.Return?.Status == 200;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMS template exception for {Mobile}", mobile);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // NormalizeMobile: نرمال‌سازی شماره موبایل
    //
    // کاوه‌نگار شماره رو به صورت 09xxxxxxxxx می‌خواد.
    // اگه کاربر با +98 وارد کرده باشه، تبدیلش می‌کنیم.
    //
    // مثال‌ها:
    // +989123456789 → 09123456789
    // 989123456789  → 09123456789
    // 09123456789   → 09123456789 (بدون تغییر)
    // ──────────────────────────────────────────────────────────────
    private static string NormalizeMobile(string mobile)
    {
        mobile = mobile.Replace("+98", "0").Replace(" ", "").Trim();
        if (mobile.StartsWith("98")) mobile = "0" + mobile[2..]; // mobile[2..] = از کاراکتر سوم تا آخر
        return mobile;
    }

    // ── کلاس‌های خصوصی برای تجزیه پاسخ JSON کاوه‌نگار ────────
    // KavenegarResponse.Return.Status == 200 یعنی موفق
    private class KavenegarResponse
    {
        public KavenegarReturn? Return { get; set; }
    }
    private class KavenegarReturn
    {
        public int Status    { get; set; } // 200 = موفق
        public string? Message { get; set; } // توضیح خطا (اگه بود)
    }
}
