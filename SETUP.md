# راهنمای راه‌اندازی سیستم مدیریت کلینیک

## پیش‌نیازها
- .NET 8 SDK
- Node.js 18+
- SQL Server (localdb یا Express)

---

## ۱. Backend — ASP.NET Core

```bash
cd ClinicSystem/src/ClinicSystem.API

# نصب packages
dotnet restore

# تنظیم appsettings.json
# رشته اتصال SQL Server را در ConnectionStrings:Default وارد کنید
# کلیدهای Kavenegar, Telegram, WhatsApp را پر کنید

# Migration و ایجاد دیتابیس
dotnet ef migrations add InitialCreate --project ../ClinicSystem.Infrastructure
dotnet ef database update --project ../ClinicSystem.Infrastructure

# اجرا
dotnet run
# API در http://localhost:5000 در دسترس است
# Swagger: http://localhost:5000/swagger
```

---

## ۲. Frontend — Next.js

```bash
cd ClinicSystem/frontend

# کپی env
cp .env.local.example .env.local

# نصب packages
npm install

# اجرا
npm run dev
# در http://localhost:3000 باز می‌شود
```

---

## ۳. اطلاعات پیش‌فرض (Seed)

| نقش      | موبایل       | رمز عبور   |
|----------|-------------|------------|
| دکتر/سوپر ادمین | 09120000000 | Admin@12345 |

---

## ۴. تنظیم سرویس‌های خارجی

### کاوه‌نگار (SMS)
1. ثبت‌نام در [kavenegar.com](https://kavenegar.com)
2. دریافت API Key
3. در `appsettings.json` → `Kavenegar:ApiKey`

### تلگرام Bot
1. ساخت bot با @BotFather
2. دریافت Token
3. در `appsettings.json` → `Telegram:BotToken`

### واتساپ Cloud API (Meta)
1. ایجاد Meta Business App
2. دریافت PhoneNumberId و AccessToken
3. در `appsettings.json` → `WhatsApp:PhoneNumberId` و `WhatsApp:AccessToken`

---

## ۵. ساختار معماری

```
ClinicSystem/
├── src/
│   ├── ClinicSystem.Domain/          ← Entities, Enums (هیچ dependency ندارد)
│   ├── ClinicSystem.Application/     ← Interfaces, Services, DTOs
│   ├── ClinicSystem.Infrastructure/  ← EF Core, JWT, SMS, Telegram, WhatsApp
│   └── ClinicSystem.API/            ← Controllers, Hubs, Middleware
└── frontend/                        ← Next.js 14 + TypeScript + Tailwind
```

---

## ۶. قابلیت‌های پیاده‌سازی شده

| قابلیت | وضعیت |
|--------|--------|
| احراز هویت JWT + Refresh Token | ✅ |
| نقش‌های پویا (SuperAdmin, Admin, Patient) | ✅ |
| مدیریت نوبت با اسلات‌بندی خودکار | ✅ |
| پرونده پزشکی کامل | ✅ |
| نسخه آنلاین با کد یکتا | ✅ |
| مشاوره آنلاین با چت real-time (SignalR) | ✅ |
| ویزیت آنلاین (Meeting Link) | ✅ |
| یادآور SMS روز قبل (Background Service) | ✅ |
| ارسال پیام تلگرام | ✅ |
| ارسال WhatsApp (Meta Cloud API) | ✅ |
| چارت‌های پیشرفت علائم حیاتی | ✅ |
| داشبورد با نمودار هفتگی/ماهانه | ✅ |
| پنل بیمار با login اختصاصی | ✅ |
| دوزبانه فارسی/انگلیسی با RTL/LTR | ✅ |
| برنامه کاری و روزهای تعطیل | ✅ |
| Soft Delete | ✅ |
| Global Exception Middleware | ✅ |
| Swagger Documentation | ✅ |
