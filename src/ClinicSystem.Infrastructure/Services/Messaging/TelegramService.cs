// ══════════════════════════════════════════════════════════════
// TelegramService — سرویس ارسال پیام تلگرام
//
// تلگرام یه API رایگان داره که میشه ازش ربات ساخت.
// این سرویس از طریق Bot API تلگرام پیام میفرسته.
//
// نحوه کار:
// ۱. یه ربات در تلگرام میسازیم (از @BotFather)
// ۲. یه BotToken می‌گیریم
// ۳. وقتی بیمار ChatId تلگرامشو وارد کنه، بهش پیام میفرستیم
//
// تنظیمات در appsettings.json:
// "Telegram": {
//   "BotToken": "123456:ABCDef..." (از @BotFather)
// }
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace ClinicSystem.Infrastructure.Services.Messaging;

public class TelegramService : ITelegramService
{
    private readonly HttpClient _httpClient;

    // BotToken = کلید ربات تلگرام (از @BotFather)
    private readonly string _botToken;

    private readonly ILogger<TelegramService> _logger;

    public TelegramService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<TelegramService> logger)
    {
        _httpClient = httpClient;
        _botToken   = config["Telegram:BotToken"]
            ?? throw new InvalidOperationException("Telegram BotToken not configured.");
        _logger = logger;
    }

    // ──────────────────────────────────────────────────────────────
    // SendMessageAsync: ارسال پیام متنی به یه chat
    //
    // chatId: شناسه گفتگو در تلگرام (کاربر باید به ربات پیام داده باشه)
    // message: متن پیام (می‌تونه HTML داشته باشه)
    //
    // API تلگرام: POST /bot{token}/sendMessage
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendMessageAsync(string chatId, string message, CancellationToken ct = default)
    {
        try
        {
            var url = $"https://api.telegram.org/bot{_botToken}/sendMessage";

            // آبجکت JSON که به API تلگرام میفرستیم
            var payload = new
            {
                chat_id    = chatId,
                text       = message,
                parse_mode = "HTML" // میشه <b>متن بولد</b> یا <i>ایتالیک</i> نوشت
            };

            var json     = JsonSerializer.Serialize(payload);
            var response = await _httpClient.PostAsync(url,
                new StringContent(json, Encoding.UTF8, "application/json"), ct);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Telegram message sent to {ChatId}", chatId);
                return true;
            }

            var error = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Telegram failed to {ChatId}: {Error}", chatId, error);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram exception for {ChatId}", chatId);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────
    // SendMessageWithButtonsAsync: ارسال پیام با دکمه‌های inline
    //
    // تلگرام از "inline keyboard" پشتیبانی می‌کنه —
    // دکمه‌هایی که زیر پیام نمایش داده میشن.
    // مثلاً: [تأیید نوبت] [لغو]
    //
    // buttons: لیست (متن دکمه، داده callback) برای هر دکمه
    // ──────────────────────────────────────────────────────────────
    public async Task<bool> SendMessageWithButtonsAsync(
        string chatId, string message,
        List<(string Text, string CallbackData)> buttons,
        CancellationToken ct = default)
    {
        try
        {
            var url = $"https://api.telegram.org/bot{_botToken}/sendMessage";

            // ساختار Inline Keyboard برای API تلگرام
            var inlineKeyboard = new
            {
                // آرایه‌ای از ردیف‌ها — ما یه ردیف داریم
                inline_keyboard = new[]
                {
                    // هر دکمه: متن + داده‌ای که وقتی کلیک میشه به ربات میاد
                    buttons.Select(b => new
                    {
                        text          = b.Text,
                        callback_data = b.CallbackData
                    }).ToArray()
                }
            };

            var payload = new
            {
                chat_id      = chatId,
                text         = message,
                parse_mode   = "HTML",
                reply_markup = inlineKeyboard // دکمه‌ها
            };

            var json     = JsonSerializer.Serialize(payload);
            var response = await _httpClient.PostAsync(url,
                new StringContent(json, Encoding.UTF8, "application/json"), ct);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram button message exception for {ChatId}", chatId);
            return false;
        }
    }
}
