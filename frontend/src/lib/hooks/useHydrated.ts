// ══════════════════════════════════════════════════════════════
// useAuthHydrated — «آیا اطلاعات لاگین از localStorage خونده شده؟»
//
// چرا این لازمه؟
// اطلاعات لاگین توی localStorage ذخیره میشه. ولی Next.js صفحه رو
// اول روی سرور می‌سازه، جایی که localStorage اصلاً وجود نداره.
// پس اولین رندری که مرورگر انجام میده، هنوز فکر می‌کنه کاربر
// لاگین نکرده — چند میلی‌ثانیه بعد اطلاعات از حافظه خونده میشه.
//
// نتیجه‌ی نادیده گرفتنش: با هر بار Refresh کردن صفحه‌های پنل،
// کاربر لاگین‌کرده پرت می‌شد به صفحه ورود!
//
// این هوک true برمی‌گردونه فقط وقتی که خوندن از حافظه تموم شده
// باشه. تا اون لحظه نباید در مورد لاگین بودن یا نبودن کاربر
// تصمیمی گرفت.
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useStore";

export function useAuthHydrated() {
  // عمداً از false شروع می‌کنیم تا با چیزی که سرور ساخته یکی باشه
  // (وگرنه React خطای hydration mismatch میده)
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // ممکنه تا وقتی این effect اجرا میشه، خوندن از حافظه تموم شده باشه
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);

    // وگرنه منتظر می‌مونیم تا تموم بشه
    // مقدار برگشتی، تابع لغو اشتراکه که React موقع unmount صداش می‌زنه
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
