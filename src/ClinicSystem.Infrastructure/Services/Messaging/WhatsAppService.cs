// ══════════════════════════════════════════════════════════════
// WhatsAppService — سرویس ارسال پیام واتساپ
//
// از WhatsApp Cloud API شرکت Meta (فیسبوک) استفاده می‌کنه.
// این API رسمی واتساپ برای کسب‌وکارهاست.
//
// برای استفاده نیاز داریم به:
// - یه شماره کسب‌وکار واتساپ (Business Account)
// - PhoneNumberId از پنل Meta Business
// - Access Token از Meta Business API
//
// تنظیمات در appsettings.json:
// "WhatsApp": {
//   "PhoneNumberId": "شناسه شماره تلفن از Meta",
//   "AccessToken":   "توکن دسترسی از Meta"
// }
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace ClinicSystem.Infrastructure.Services.Messaging;

public class WhatsAppService : IWhatsAppService
{
    private readonly HttpClient _httpClient;

    // PhoneNumberId: شناسه شماره واتساپ کسب‌وکار در Meta
    private readonly string _phoneNumberId;

    // AccessToken: کلید احراز هویت Meta Business API
    private readonly string _accessToken;

    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<WhatsAppService> logger)
    {
        _httpClient    = httpClient;
        _phoneNumberId = config["WhatsApp:PhoneNumberId"]
            ?? throw new InvalidOperationException("WhatsApp PhoneNumberId not configured.");
        _accessToken   = config["WhatsApp:AccessToken"]
            ?? throw new InvalidOperationException("WhatsApp AccessToken not configured.");
        _logger = logger;

        // توکن رو به عنوان هدر Bearer Authentication اضافه می‌کنه
        // این یعنی همه درخواست‌های این HttpClient خودکار با Bearer ارسال میشن
        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
    }

    // ──────────────────────────────────────────────────────────────
    // SendMessageAsync: ارسال پیام متنی آزاد
    //
    // phoneNumber: شماره گیرنده (هر فرمتی — نرمال‌سازی انجام میشه)
    // message: متن پیام
    //
    // API Meta: POST /v18.0/{phoneNumberId}/messages
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendMessageAsync(
        string phoneNumber, string message, CancellationToken ct = default)
    {
        try
        {
            var url = $"https://graph.facebook.com/v18.0/{_phoneNumberId}/messages";

            // ساختار JSON برای API واتساپ
            var payload = new
            {
                messaging_product = "whatsapp",        // همیشه "whatsapp"
                to   = NormalizePhone(phoneNumber),     // شماره گیرنده (فرمت بین‌المللی بدون +)
                type = "text",                          // نوع پیام: متنی
                text = new { body = message }           // متن پیام
            };

            var json     = JsonSerializer.Serialize(payload);
            var response = await _httpClient.PostAsync(url,
                new StringContent(json, Encoding.UTF8, "application/json"), ct);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("WhatsApp message sent to {Phone}", phoneNumber);
                return true;
            }

            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("WhatsApp failed to {Phone}: {Error}", phoneNumber, error);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WhatsApp exception for {Phone}", phoneNumber);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // SendTemplateAsync: ارسال پیام از روی قالب تأییدشده
    //
    // واتساپ اجازه نمیده پیام آزاد بفرستی — اول باید قالب
    // رو به Meta ارائه بدی و بعد از تأییدشدن ازش استفاده کنی.
    //
    // templateName: نام قالب در پنل Meta
    // parameters: مقادیری که توی قالب جاگذاری میشن
    // مثال: قالب "appointment_reminder" با پارامتر ["علی رضایی", "۱۵:۳۰"]
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendTemplateAsync(
        string phoneNumber, string templateName,
        List<string> parameters, CancellationToken ct = default)
    {
        try
        {
            var url = $"https://graph.facebook.com/v18.0/{_phoneNumberId}/messages";

            // اگه پارامتر داریم، آرایه components میسازیم
            var components = parameters.Any() ? new object[]
            {
                new
                {
                    type       = "body", // پارامترهای متن اصلی پیام
                    parameters = parameters
                        .Select(p => new { type = "text", text = p }) // هر پارامتر به صورت متن
                        .ToArray()
                }
            } : Array.Empty<object>(); // اگه پارامتر نداریم، خالی

            var payload = new
            {
                messaging_product = "whatsapp",
                to       = NormalizePhone(phoneNumber),
                type     = "template", // نوع پیام: قالب
                template = new
                {
                    name       = templateName,       // نام قالب تأییدشده
                    language   = new { code = "fa" }, // زبان فارسی
                    components                        // پارامترهای قالب
                }
            };

            var json     = JsonSerializer.Serialize(payload);
            var response = await _httpClient.PostAsync(url,
                new StringContent(json, Encoding.UTF8, "application/json"), ct);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WhatsApp template exception for {Phone}", phoneNumber);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // NormalizePhone: نرمال‌سازی شماره موبایل برای API واتساپ
    //
    // واتساپ شماره رو به فرمت بین‌المللی بدون + می‌خواد:
    // 09123456789  → 989123456789
    // +989123456789 → 989123456789 (بدون +)
    // ──────────────────────────────────────────────────────────────
    private static string NormalizePhone(string phone)
    {
        phone = phone.Replace("+", "").Replace(" ", "").Trim(); // حذف + و فاصله
        if (phone.StartsWith("0"))
            phone = "98" + phone[1..]; // 09... → 989... (پیش‌شماره ایران)
        return phone;
    }
}
