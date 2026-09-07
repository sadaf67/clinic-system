// ══════════════════════════════════════════════════════════════
// ServiceExtensions — ثبت سرویس‌ها و تنظیمات برنامه
//
// در ASP.NET Core، قبل از راه‌اندازی برنامه باید همه
// سرویس‌ها رو "معرفی" کنیم. این کار توی Program.cs انجام میشه.
//
// برای اینکه Program.cs خیلی شلوغ نشه، اینجا همه ثبت‌سرویس‌ها
// رو به صورت متدهای extension جداگانه نوشتیم.
// هر متد یه بخش مشخص از تنظیمات رو انجام میده.
// ══════════════════════════════════════════════════════════════

using System.Text;
using ClinicSystem.API.Hubs;
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Application.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Infrastructure.Data;
using ClinicSystem.Infrastructure.Identity;
using ClinicSystem.Infrastructure.Repositories;
using AuthService = ClinicSystem.Infrastructure.Identity.AuthService;
using ClinicSystem.Infrastructure.Services.Messaging;
using ClinicSystem.Infrastructure.Services.Notification;
using ClinicSystem.Infrastructure.Services.SMS;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

namespace ClinicSystem.API.Extensions;

// static = نیازی به ساختن نمونه نداره — مستقیم صدا زده میشه
public static class ServiceExtensions
{
    // ──────────────────────────────────────────────────────────────
    // AddDatabase: وصل کردن برنامه به SQL Server
    //
    // رشته اتصال از appsettings.json خونده میشه:
    // "ConnectionStrings": { "Default": "Server=...;Database=..." }
    //
    // MigrationsAssembly: Migration‌ها در پروژه Infrastructure هستن
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ClinicDbContext>(opt =>
            opt.UseSqlServer(
                config.GetConnectionString("Default"), // آدرس دیتابیس از appsettings
                b => b.MigrationsAssembly("ClinicSystem.Infrastructure") // migration‌ها کجان
            ));
        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddIdentityConfig: تنظیم ASP.NET Identity (سیستم کاربران)
    //
    // قوانین رمز عبور:
    // - حداقل ۸ کاراکتر
    // - باید حداقل ۱ عدد داشته باشه
    // - نیازی به حروف بزرگ یا کاراکتر خاص نیست
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddIdentityConfig(this IServiceCollection services)
    {
        services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(opt =>
        {
            // قوانین پسورد
            opt.Password.RequireDigit           = true;  // باید عدد داشته باشه
            opt.Password.RequiredLength         = 8;     // حداقل ۸ کاراکتر
            opt.Password.RequireNonAlphanumeric = false; // نیازی به !@#$ نیست
            opt.Password.RequireUppercase       = false; // نیازی به حرف بزرگ نیست

            // email منحصربه‌فرد نباشه — چون ممکنه ایمیل نداشته باشن
            opt.User.RequireUniqueEmail = false;
            opt.Lockout.AllowedForNewUsers = true;
            opt.Lockout.MaxFailedAccessAttempts = 5;
            opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        })
        .AddEntityFrameworkStores<ClinicDbContext>() // ذخیره در SQL Server
        .AddDefaultTokenProviders();                  // برای ریست رمز و...

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddJwtAuth: تنظیم احراز هویت JWT
    //
    // JWT = JSON Web Token — یه توکن رمزنگاری‌شده که
    // بعد از لاگین به کاربر داده میشه. هر درخواست بعدی
    // این توکن رو توی هدر میفرسته تا هویتش اثبات بشه.
    //
    // تنظیمات از appsettings.json:
    // "Jwt": { "Key": "...", "Issuer": "...", "Audience": "..." }
    //
    // نکته مهم: SignalR توکن رو از query string می‌گیره
    // (چون WebSocket هدر Authorization رو پشتیبانی نمی‌کنه)
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddJwtAuth(this IServiceCollection services, IConfiguration config)
    {
        // کلید رمزنگاری رو از appsettings می‌خونه و تبدیل به byte می‌کنه
        var key = Encoding.UTF8.GetBytes(config["Jwt:Key"]!);

        services.AddAuthentication(opt =>
        {
            // طرح پیش‌فرض احراز هویت: JWT Bearer
            opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            opt.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(opt =>
        {
            opt.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,                         // کلید امضا رو اعتبارسنجی کن
                IssuerSigningKey         = new SymmetricSecurityKey(key), // کلید رمزنگاری
                ValidateIssuer           = true,
                ValidIssuer              = config["Jwt:Issuer"],          // صادرکننده توکن
                ValidateAudience         = true,
                ValidAudience            = config["Jwt:Audience"],         // مخاطب توکن
                ValidateLifetime         = true,                          // انقضا رو چک کن
                ClockSkew                = TimeSpan.Zero                  // هیچ تلرانسی برای زمان نباشه
            };

            // ── JWT برای SignalR (WebSocket) ──────────────────────
            // مرورگر نمی‌تونه هدر Authorization رو توی WebSocket بفرسته
            // پس توکن رو توی query string میفرسته:
            // /hubs/consultation?access_token=eyJ...
            opt.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var accessToken = ctx.Request.Query["access_token"]; // توکن از URL
                    var path        = ctx.HttpContext.Request.Path;

                    // فقط برای آدرس‌هایی که با /hubs شروع میشن
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        ctx.Token = accessToken;

                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddRepositories: ثبت ریپازیتوری‌ها (الگوی Repository)
    //
    // ریپازیتوری = لایه‌ای بین کنترلر و دیتابیس
    // هر چیزی که از دیتابیس می‌خونیم/مینویسیم از این‌ها رد میشه
    //
    // AddScoped = یه نمونه جدید برای هر HTTP Request ساخته میشه
    // (مناسب‌ترین lifetime برای دیتابیس)
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        // ریپازیتوری عمومی — برای هر Entity قابل استفاده‌ست
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));

        // ریپازیتوری‌های تخصصی با متدهای اضافه
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IAppointmentRepository, AppointmentRepository>();

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddApplicationServices: ثبت سرویس‌های لایه Application
    //
    // سرویس‌های Application حاوی منطق تجاری (Business Logic) هستن
    // مثلاً AppointmentService چک می‌کنه دکتر توی اون ساعت فعاله
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAppointmentService, AppointmentService>(); // بررسی ساعت‌های خالی
        services.AddScoped<INotificationService, NotificationService>(); // ارسال نوتیفیکیشن
        services.AddScoped<IAuthService, AuthService>();               // لاگین و رفرش توکن
        services.AddScoped<JwtTokenService>();                          // تولید توکن JWT
        services.AddSingleton<IRealtimeNotifier, SignalRRealtimeNotifier>(); // پوش لحظه‌ای اعلان از طریق SignalR

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddExternalServices: سرویس‌های خارجی (SMS، تلگرام، یادآوری)
    //
    // AddHttpClient: ایجاد HttpClient بهینه برای هر سرویس
    // AddHostedService: سرویس پس‌زمینه که همیشه در حال اجراست
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddExternalServices(this IServiceCollection services)
    {
        services.AddHttpClient<ISmsService, KavenegarSmsService>();      // ارسال SMS از طریق کاوه‌نگار
        services.AddHttpClient<ITelegramService, TelegramService>();      // ارسال پیام تلگرام
        services.AddHttpClient<IWhatsAppService, WhatsAppService>();      // ارسال پیام واتساپ
        services.AddSingleton<ITelemedicineService, ConfiguredTelemedicineService>();
        services.AddHostedService<ReminderBackgroundService>();            // یادآوری نوبت‌ها (روزی یه بار)

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddSwaggerConfig: تنظیم Swagger (مستندات API)
    //
    // Swagger یه صفحه وب میسازه که همه API‌ها رو نشون میده
    // و میتونی مستقیماً تستشون کنی.
    // آدرس: http://localhost:5000/swagger
    //
    // Bearer JWT هم اضافه شده تا بتونی توی Swagger هم
    // با توکن تست کنی (دکمه Authorize)
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddSwaggerConfig(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title       = "Clinic Management System API",
                Version     = "v1",
                Description = "سیستم مدیریت کلینیک پزشکی"
            });

            // اضافه کردن دکمه "Authorize" برای JWT توی Swagger UI
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name        = "Authorization",
                Type        = SecuritySchemeType.Http,
                Scheme      = "Bearer",
                BearerFormat= "JWT",
                In          = ParameterLocation.Header
            });

            // همه endpoint‌ها به JWT نیاز دارن
            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    },
                    Array.Empty<string>()
                }
            });
        });

        return services;
    }

    // ──────────────────────────────────────────────────────────────
    // AddCorsConfig: تنظیم CORS (Cross-Origin Resource Sharing)
    //
    // CORS = اجازه دادن به یه آدرس خارجی برای استفاده از API
    //
    // مشکل: مرورگر به صورت پیش‌فرض اجازه نمیده یه سایت
    // (مثل localhost:3000) به سایت دیگه (localhost:5000) درخواست بفرسته.
    // با تنظیم CORS این محدودیت رو برمیداریم.
    //
    // AllowedOrigins از appsettings.json خونده میشه
    // AllowCredentials: لازمه چون JWT و Cookie رد میشن
    // ──────────────────────────────────────────────────────────────
    public static IServiceCollection AddCorsConfig(this IServiceCollection services, IConfiguration config)
    {
        var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>()
                             ?? new[] { "http://localhost:3000" }; // پیش‌فرض: آدرس Next.js

        services.AddCors(opt =>
            opt.AddPolicy("ClinicPolicy", policy =>
                policy.WithOrigins(allowedOrigins)   // فقط این آدرس‌ها مجازن
                      .AllowAnyMethod()               // همه HTTP methods (GET, POST, PUT, DELETE...)
                      .AllowAnyHeader()               // همه هدرها
                      .AllowCredentials()             // اجازه ارسال توکن و کوکی
            ));

        return services;
    }
}
