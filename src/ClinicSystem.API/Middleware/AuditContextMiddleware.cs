using ClinicSystem.Infrastructure.Data;
using System.Security.Claims;

namespace ClinicSystem.API.Middleware;

public class AuditContextMiddleware
{
    private readonly RequestDelegate _next;
    public AuditContextMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var idValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        AuditContext.Current = new AuditActor(
            Guid.TryParse(idValue, out var id) ? id : null,
            context.User.Identity?.Name ?? "anonymous",
            context.Connection.RemoteIpAddress?.ToString(),
            context.TraceIdentifier);
        try { await _next(context); }
        finally { AuditContext.Current = null; }
    }
}
