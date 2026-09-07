# ClinicSystem — سامانهٔ نوبت‌دهی و مدیریت مطب

سامانهٔ جامع مدیریت کلینیک و مطب: نوبت‌دهی آنلاین بیماران، پروندهٔ الکترونیک، و پنل مدیریت پزشک و منشی.

## معماری

```
src/
├── ClinicSystem.Domain          # موجودیت‌ها و قواعد کسب‌وکار
├── ClinicSystem.Application     # سرویس‌ها، DTOها، ولیدیشن
├── ClinicSystem.Infrastructure  # EF Core، Repositoryها، پیامک، تلگرام
└── ClinicSystem.API             # REST API + احراز هویت JWT

frontend/                        # اپ Next.js + TypeScript + Tailwind
tests/ClinicSystem.Tests         # تست‌های خودکار
```

## تکنولوژی‌ها

| لایه | ابزار |
| --- | --- |
| بک‌اند | ASP.NET Core 8، EF Core، Clean Architecture |
| فرانت‌اند | Next.js، TypeScript، Tailwind CSS |
| احراز هویت | JWT + نقش‌محور (بیمار / منشی / پزشک / مدیر) |
| اطلاع‌رسانی | پیامک کاوه‌نگار، ربات تلگرام، WhatsApp Cloud API |
| استقرار | Docker + docker-compose، GitHub Actions |

## قابلیت‌ها

- **نوبت‌دهی آنلاین** با تقویم شمسی، تعریف شیفت و بازهٔ زمانی برای هر پزشک و جلوگیری از رزرو هم‌زمان یک اسلات.
- **مدیریت بیماران** و پروندهٔ الکترونیک: سوابق مراجعه، تشخیص، نسخه و فایل‌های پیوست.
- **یادآوری خودکار نوبت** از طریق پیامک و پیام‌رسان پیش از موعد ویزیت.
- **پنل مدیریت** برای پزشک و منشی: مشاهدهٔ نوبت‌های روز، ثبت ویزیت، لغو و جابه‌جایی نوبت.
- **گزارش‌گیری**: آمار مراجعات، درآمد و نرخ عدم‌حضور.
- **دسترسی نقش‌محور** روی همهٔ اندپوینت‌ها.

## اجرای محلی

```bash
# بک‌اند
cp .env.example .env          # مقادیر را پر کنید
dotnet restore
dotnet ef database update --project src/ClinicSystem.Infrastructure --startup-project src/ClinicSystem.API
dotnet run --project src/ClinicSystem.API

# فرانت‌اند
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

یا با Docker:

```bash
docker compose up -d --build
```

## مستندات بیشتر

- [`SETUP.md`](SETUP.md) — راه‌اندازی گام‌به‌گام
- [`OPERATIONS.md`](OPERATIONS.md) — نکات نگهداری و عملیات

> فایل‌های `.env`، `appsettings.Development.json` و هر فایل حاوی کلید محرمانه در `.gitignore` هستند و نباید commit شوند.
