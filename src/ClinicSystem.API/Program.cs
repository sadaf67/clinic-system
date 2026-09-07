// ══════════════════════════════════════════════════════════════
// این فایل "نقطه شروع" برنامه هست - اولین چیزی که اجرا میشه
// مثل main() در C یا Java
// اینجا همه چیز رو تنظیم می‌کنیم:
// - اتصال به دیتابیس
// - سیستم لاگین و JWT
// - سرویس‌ها
// - Swagger (داکیومنت API)
// - CORS (اجازه دادن به فرانتند برای صدا زدن API)
// ══════════════════════════════════════════════════════════════
using ClinicSystem.API.Extensions;
using ClinicSystem.API.Hubs;
using ClinicSystem.API.Middleware;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;
using ClinicSystem.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

// ─── ساختن برنامه ─────────────────────────────────────────────
var builder = WebApplication.CreateBuilder(args);

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be configured and contain at least 32 characters.");

// کنترلرها رو اضافه کن (هر Controller یه دسته از API endpoints هست)
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// برای Swagger لازمه
builder.Services.AddEndpointsApiExplorer();
// SignalR برای چت آنلاین و اعلان‌های لحظه‌ای
builder.Services.AddSignalR();

// تنظیمات رو از فایل‌های Extension بارگذاری کن (کد تمیزتر)
builder.Services
    .AddDatabase(builder.Configuration)       // اتصال به SQL Server
    .AddIdentityConfig()                      // سیستم کاربران و نقش‌ها
    .AddJwtAuth(builder.Configuration)        // احراز هویت با توکن JWT
    .AddRepositories()                        // Repository های دیتابیس
    .AddApplicationServices()                 // سرویس‌های منطق تجاری
    .AddExternalServices()                    // سرویس‌های خارجی (SMS، تلگرام)
    .AddSwaggerConfig()                       // مستندات API
    .AddCorsConfig(builder.Configuration);    // تنظیمات CORS

// ─── ساختن و پیکربندی برنامه ──────────────────────────────────
var app = builder.Build();

// قبل از شروع، دیتابیس رو راه‌اندازی و داده‌های اولیه رو وارد کن
await SeedAsync(app);

// Swagger UI - صفحه تست API (فقط در محیط توسعه)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Clinic API v1");
        c.RoutePrefix = "swagger"; // آدرس: http://localhost:5000/swagger
    });
}

// ─── ترتیب Middleware ها مهمه! ────────────────────────────────
// Middleware = لایه‌هایی که هر درخواست از اون‌ها رد میشه

app.UseMiddleware<ExceptionMiddleware>(); // خطاها رو به شکل JSON مرتب برگردون
app.UseCors("ClinicPolicy");             // اجازه بده فرانتند (localhost:3000) صدا بزنه
app.UseAuthentication();                 // توکن رو چک کن (کیه این؟)
app.UseMiddleware<AuditContextMiddleware>();
app.UseAuthorization();                  // دسترسی رو چک کن (حق داره؟)
app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();
app.MapControllers();                    // مسیرهای API رو فعال کن
app.MapHub<ConsultationHub>("/hubs/consultation"); // WebSocket برای چت آنلاین

// شروع!
app.Run();

// ══════════════════════════════════════════════════════════════
// Seed = کاشتن داده‌های اولیه (مثل کاشتن بذر در زمین)
// این متد اولین بار که برنامه اجرا میشه:
// ۱. دیتابیس رو میسازه (اگه وجود نداشته باشه)
// ۲. Migration ها رو اجرا می‌کنه (جداول رو می‌سازه)
// ۳. نقش‌ها رو اضافه می‌کنه (SuperAdmin، Admin، Patient)
// ۴. اکانت دکتر اصلی رو می‌سازه
// ══════════════════════════════════════════════════════════════
static async Task SeedAsync(WebApplication app)
{
    // یه محیط موقت بساز (مثل باز کردن یه پنجره کار)
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
    var userMgr = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleMgr = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

    // Migration های جدید رو اجرا کن (جداول جدید رو بساز)
    // اگه دیتابیس وجود نداشته باشه اون رو هم می‌سازه
    await db.Database.MigrateAsync();

    // Keep existing installations usable after introducing multi-branch support.
    if (!await db.ClinicBranches.IgnoreQueryFilters().AnyAsync())
    {
        db.ClinicBranches.Add(new ClinicBranch
        {
            Name = "شعبه اصلی",
            TimeZoneId = "Iran Standard Time",
            IsActive = true
        });
        await db.SaveChangesAsync();
    }

    // نقش‌های سیستم رو بساز (اگه وجود ندارن)
    // GetNames<UserRole>() = ["SuperAdmin", "Admin", "Patient"]
    foreach (var role in Enum.GetNames<UserRole>())
        if (!await roleMgr.RoleExistsAsync(role))
            await roleMgr.CreateAsync(new IdentityRole<Guid>(role));

    // اکانت دکتر اصلی رو بساز (اگه وجود نداشت)
    // این اکانت برای اولین ورود به سیستم استفاده میشه
    var doctorPhone = app.Configuration["Seed:AdminPhone"] ?? "09120000000";
    var doctor = await userMgr.FindByNameAsync(doctorPhone);
    if (doctor == null)
    {
        var doctorPassword = app.Configuration["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(doctorPassword))
            throw new InvalidOperationException("Seed:AdminPassword must be configured when creating the initial administrator.");

        doctor = new ApplicationUser
        {
            UserName = doctorPhone,          // نام کاربری = شماره موبایل
            PhoneNumber = doctorPhone,
            FirstName = "دکتر احمد",
            LastName = "محمدی",
            FirstNameEn = "Dr. Ahmad",
            LastNameEn = "Mohammadi",
            Role = UserRole.SuperAdmin,      // دکتر = بالاترین سطح دسترسی
            IsActive = true,
            EmailConfirmed = true,
            PhoneNumberConfirmed = true
        };
        // رمز عبور پیش‌فرض - حتماً بعد از اولین ورود عوض بشه!
        var createResult = await userMgr.CreateAsync(doctor, doctorPassword);
        if (!createResult.Succeeded)
            throw new InvalidOperationException(
                "Failed to create the initial administrator: " +
                string.Join(", ", createResult.Errors.Select(e => e.Description)));

        var roleResult = await userMgr.AddToRoleAsync(doctor, nameof(UserRole.SuperAdmin));
        if (!roleResult.Succeeded)
            throw new InvalidOperationException(
                "Failed to assign the initial administrator role: " +
                string.Join(", ", roleResult.Errors.Select(e => e.Description)));
    }
}
