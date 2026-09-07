// ══════════════════════════════════════════════════════════════
// sw.js — سرویس‌ورکر ساده برای نصب‌پذیری PWA
//
// چرا لازمه؟
// مرورگر (کروم/اندروید) فقط وقتی دکمه «نصب» رو نشون میده که
// علاوه بر manifest.json، یه سرویس‌ورکر با fetch handler هم
// ثبت شده باشه. این فایل حداقلی‌ترین حالت اون رو پیاده می‌کنه:
//
// ۱. فایل‌های استاتیک (JS/CSS/آیکون) رو کش می‌کنه تا بار بعد
//    سریع‌تر لود بشن و یه حداقل تجربه‌ی آفلاین هم بدن.
// ۲. برای درخواست‌های API (/api/...) دست نمی‌زنه — همیشه مستقیم
//    از شبکه میره، چون داده‌های پزشکی نباید کهنه/کش‌شده نمایش
//    داده بشن.
// ۳. استراتژی network-first با fallback به کش: همیشه اول از
//    شبکه امتحان می‌کنه (تا آخرین نسخه رو بگیره)، فقط اگه شبکه
//    قطع بود میره سراغ کش.
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = "clinic-shell-v1";

// نصب: کش اولیه (خالی شروع می‌کنیم، صفحات با اولین بازدید کش میشن)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// فعال‌سازی: کش‌های نسخه‌های قدیمی رو پاک کن
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // فقط GET رو کش کن؛ و کاری به درخواست‌های API یا SignalR نداشته باش
  // (داده‌های زنده پزشکی هیچ‌وقت نباید از کش قدیمی نشون داده بشن)
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/hubs/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // کپی از پاسخ رو توی کش ذخیره کن (پاسخ فقط یه‌بار قابل خوندنه)
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() =>
        // شبکه قطعه → اگه نسخه کش‌شده داریم همون رو بده
        caches.match(request).then((cached) => cached || Promise.reject("no-cache"))
      )
  );
});
