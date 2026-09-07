// ══════════════════════════════════════════════════════════════
// JWT = JSON Web Token = کارت شناسایی دیجیتال
// وقتی کاربر لاگین می‌کنه، یه "کارت" بهش میدیم
// کاربر این کارت رو با هر درخواست میفرسته تا ثابت کنه کیه
// کارت قابل جعل نیست چون با یه کلید مخفی امضا شده
// ══════════════════════════════════════════════════════════════
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ClinicSystem.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ClinicSystem.Infrastructure.Identity;

public class JwtTokenService
{
    // تنظیمات از فایل appsettings.json خونده میشه (کلید مخفی، مدت اعتبار و...)
    private readonly IConfiguration _config;

    public JwtTokenService(IConfiguration config) => _config = config;

    // ─── ساخت توکن دسترسی (Access Token) ─────────────────────
    // این توکن کوتاه‌مدته (مثلاً ۶۰ دقیقه) و با هر درخواست فرستاده میشه
    public string GenerateAccessToken(ApplicationUser user, IList<string> roles)
    {
        // کلید مخفی رو از تنظیمات بخون - این کلید رو هیچکس نباید بدونه!
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured.")));

        // Claims = اطلاعاتی که داخل توکن ذخیره میشن
        // مثل اینکه توی کارت شناسایی چی نوشته شده
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),    // شناسه کاربر
            new(ClaimTypes.Name, user.UserName ?? string.Empty),    // نام کاربری (شماره موبایل)
            new(ClaimTypes.MobilePhone, user.PhoneNumber ?? string.Empty), // شماره موبایل
            new("fullName", user.FullName),       // نام کامل فارسی (اضافه کردیم برای فرانتند)
            new("fullNameEn", user.FullNameEn),   // نام کامل انگلیسی
            new("role", user.Role.ToString()),    // نقش کاربر (دکتر؟ منشی؟ بیمار؟)
        };

        if (user.Patient != null)
            claims.Add(new Claim("patientId", user.Patient.Id.ToString()));

        // نقش‌های Identity هم اضافه کن (برای [Authorize(Roles="...")] استفاده میشه)
        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        // توکن رو بساز با همه تنظیماتش
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],       // کی این توکن رو صادر کرده (سرور ما)
            audience: _config["Jwt:Audience"],   // این توکن برای کجاست (کلاینت ما)
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60")), // کِی منقضی میشه
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256) // امضای دیجیتال
        );

        // توکن رو به رشته تبدیل کن (سه بخش با نقطه جدا شده: header.payload.signature)
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ─── ساخت Refresh Token ────────────────────────────────────
    // این توکن بلندمدته (۳۰ روز) و فقط برای گرفتن توکن جدید استفاده میشه
    // یه رشته تصادفی ۶۴ بایتی - غیرقابل حدس زدن!
    public string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create(); // تصادفی واقعی (نه Math.Random)
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes); // تبدیل به متن قابل ذخیره
    }

    // ─── اعتبارسنجی توکن منقضی شده ───────────────────────────
    // وقتی توکن منقضی شده ولی باید بررسی کنیم معتبر بوده یا نه
    // برای وقتی Refresh Token می‌خوایم صادر کنیم
    public ClaimsPrincipal? ValidateExpiredToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var validation = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,  // امضا رو چک کن
            IssuerSigningKey = key,
            ValidateIssuer = false,           // صادرکننده رو چک نکن
            ValidateAudience = false,         // مخاطب رو چک نکن
            ValidateLifetime = false          // مدت اعتبار رو چک نکن (چون منقضی شده!)
        };

        try
        {
            // اگه توکن معتبر بود (امضا درست بود) اطلاعات داخلش رو برگردون
            return new JwtSecurityTokenHandler().ValidateToken(token, validation, out _);
        }
        catch { return null; } // اگه توکن جعلی بود null برگردون
    }
}
