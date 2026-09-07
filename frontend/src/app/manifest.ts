// ══════════════════════════════════════════════════════════════
// manifest.ts — فایل مانیفست PWA
//
// این فایل با قرارگیری توی src/app (کنوانسیون Next.js App Router)
// خودکار روی آدرس /manifest.webmanifest سرو میشه — نیازی به
// ثبت دستی route نیست.
//
// مانیفست به مرورگر می‌گه: این یه اپلیکیشن نصب‌شدنیه، این آیکون‌ها
// رو داره، وقتی نصب شد با این اسم/رنگ/حالت (تمام‌صفحه بدون نوار
// آدرس) باز شه.
//
// چرا برای دمو مهمه؟
// پزشک می‌تونه از روی گوشی/تبلت یا کروم دسکتاپ، پنل رو مثل یه
// اپ واقعی "نصب" کنه (آیکون روی صفحه اصلی) — حس یه محصول کامل و
// حرفه‌ای رو منتقل می‌کنه، نه فقط یه سایت توی مرورگر.
// ══════════════════════════════════════════════════════════════
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سیستم مدیریت کلینیک",
    short_name: "کلینیک",
    description: "سیستم جامع مدیریت کلینیک پزشکی — نوبت‌دهی، پرونده بیماران، نسخه‌ها و مشاوره آنلاین",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f1f5f9",
    theme_color: "#2563eb",
    lang: "fa",
    dir: "rtl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
