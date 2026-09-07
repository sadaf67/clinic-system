// ══════════════════════════════════════════════════════════════
// فایل layout.tsx — اسکلت اصلی برنامه
//
// این فایل مثل قالب HTML اصلی برنامه‌ست. هر چیزی که اینجا
// تعریف کنی، روی همه صفحه‌ها تأثیر میذاره.
// کارهای اصلیش:
// ۱. فونت Vazirmatn رو (فونت فارسی) از Google Fonts بارگذاری می‌کنه
// ۲. عنوان و توضیح تب مرورگر رو تنظیم می‌کنه (metadata)
// ۳. همه صفحه‌ها رو داخل Providers می‌پیچه
// ══════════════════════════════════════════════════════════════

// Metadata = نوع TypeScript برای عنوان/توضیح صفحه در مرورگر
import type { Metadata, Viewport } from "next";

// Vazirmatn = فونت فارسی از Google Fonts
// این فونت از راست به چپ خوب نشون داده میشه
import { Vazirmatn } from "next/font/google";

// استایل‌های کلی برنامه (رنگ‌ها، کلاس‌های Tailwind)
import "./globals.css";

// Providers = لایه‌ای که جهت صفحه و toast رو مدیریت می‌کنه
import { Providers } from "./providers";

// ──────────────────────────────────────────────────────────────
// تنظیم فونت Vazirmatn
// subsets: ["arabic"] = شامل کاراکترهای عربی/فارسی هم هست
// weight = وزن‌های مختلف فونت (نازک تا خیلی ضخیم)
// variable = یه متغیر CSS میسازه به نام --font-vazir
//            که میشه توی Tailwind ازش استفاده کرد
// ──────────────────────────────────────────────────────────────
const vazir = Vazirmatn({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-vazir",
});

// ──────────────────────────────────────────────────────────────
// metadata: اطلاعاتی که در تب مرورگر نشون داده میشه
// title = عنوان صفحه (ابتدای تب مرورگر)
// description = توضیح مختصر برای موتورهای جستجو
// ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "سیستم مدیریت کلینیک | Clinic Management System",
  description: "سیستم جامع مدیریت کلینیک پزشکی",
  // manifest.ts (کنار همین فایل) خودکار توسط Next.js روی
  // /manifest.webmanifest سرو میشه — همینجا بهش لینک می‌دیم
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/icon-192.png", // آیفون/آیپد از manifest پشتیبانی نمی‌کنه، این تگ رو می‌خواد
  },
  // appleWebApp: چون سافاری/iOS دکمه نصب استاندارد PWA رو نداره،
  // این متادیتا باعث میشه وقتی کاربر از منوی Safari «افزودن به
  // صفحه اصلی» رو بزنه، اپ به‌جای یه برگه مرورگر، تمام‌صفحه باز بشه
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "کلینیک",
  },
};

// viewport: تنظیم نمایش روی موبایل + رنگ نوار بالای مرورگر موبایل
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

// ──────────────────────────────────────────────────────────────
// RootLayout: قالب اصلی — اسکلت HTML برنامه
// children = محتوای هر صفحه اینجا رندر میشه
// ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang/dir از همون اول روی فارسی/راست‌به‌چپ تنظیم میشه
    // (زبان پیش‌فرض برنامه فارسیه). بدون این، اولین رندر چپ‌به‌راست بود
    // و بعد از لود شدن جاوااسکریپت یهو می‌پرید به راست‌به‌چپ — یه پرش زشت.
    // اگه کاربر زبان رو عوض کنه، providers.tsx این دو تا رو آپدیت می‌کنه.
    // suppressHydrationWarning: چون dir ممکنه سمت کلاینت فرق کنه
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} font-vazir antialiased`}>
        {/*
          vazir.variable → کلاس CSS که متغیر --font-vazir رو میسازه
          font-vazir     → در Tailwind Config تعریف شده تا Vazirmatn رو استفاده کنه
          antialiased    → لبه‌های فونت رو صاف‌تر نشون میده
        */}

        {/* Providers همه صفحه رو دربرمی‌گیره تا جهت RTL/LTR درست باشه */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
