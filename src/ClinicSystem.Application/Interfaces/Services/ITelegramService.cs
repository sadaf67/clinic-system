namespace ClinicSystem.Application.Interfaces.Services;

public interface ITelegramService
{
    Task<bool> SendMessageAsync(string chatId, string message, CancellationToken ct = default);
    Task<bool> SendMessageWithButtonsAsync(string chatId, string message, List<(string Text, string CallbackData)> buttons, CancellationToken ct = default);
}
