// ══════════════════════════════════════════════════════════════
// این فایل "حافظه مرکزی" برنامه رو مدیریت می‌کنه
// Zustand یه کتابخونه‌ی ساده برای مدیریت State (وضعیت) در React هست
// مثل یه انبار مشترک که همه صفحات می‌تونن ازش بخونن و بهش بنویسن
//
// دو Store داریم:
// 1. useAuthStore: اطلاعات لاگین (توکن، اطلاعات کاربر)
// 2. useAppStore: تنظیمات UI (زبان، باز/بسته بودن منو)
//
// persist = ذخیره در localStorage مرورگر (با بستن مرورگر پاک نمیشه)
// ══════════════════════════════════════════════════════════════
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode"; // برای خوندن اطلاعات از توکن JWT
import type { Lang } from "@/lib/i18n";

// ─── شکل داده‌های داخل توکن JWT ───────────────────────────────
// وقتی توکن رو decode می‌کنیم، این فیلدها داخلشه
interface JwtPayload {
  nameid: string;      // شناسه کاربر (GUID)
  unique_name: string; // نام کاربری (شماره موبایل)
  mobilephone: string; // شماره موبایل
  fullName: string;    // نام کامل فارسی
  fullNameEn: string;  // نام کامل انگلیسی
  role: string;        // نقش (SuperAdmin, Admin, Patient)
  patientId?: string;  // شناسه پرونده بیمار
  exp: number;         // تاریخ انقضا (Unix timestamp)
}

// ─── شکل اطلاعات کاربر در حافظه ──────────────────────────────
interface User {
  id: string;
  username: string;
  phone: string;
  fullName: string;
  fullNameEn: string;
  role: "SuperAdmin" | "Admin" | "Patient"; // فقط این سه نقش مجاز هستن
  patientId?: string; // اگه بیمار باشه، ID پرونده‌اش اینجاست
}

// ─── شکل Store احراز هویت ─────────────────────────────────────
interface AuthState {
  accessToken: string | null;    // توکن کوتاه‌مدت (۶۰ دقیقه)
  refreshToken: string | null;   // توکن بلندمدت (۳۰ روز)
  user: User | null;             // اطلاعات کاربر لاگین کرده
  isAuthenticated: boolean;      // آیا لاگین کرده؟
  setTokens: (accessToken: string, refreshToken: string) => void; // ذخیره توکن‌ها بعد از لاگین
  logout: () => void;            // پاک کردن همه چیز موقع خروج
}

// ─── شکل Store تنظیمات برنامه ─────────────────────────────────
interface AppState {
  lang: Lang;                    // زبان: "fa" (فارسی) یا "en" (انگلیسی)
  setLang: (lang: Lang) => void; // تغییر زبان
  sidebarOpen: boolean;          // آیا منوی کناری باز هست؟
  toggleSidebar: () => void;     // باز/بسته کردن منو
  theme: "light" | "dark";       // حالت روشن/تاریک پنل مدیریت
  toggleTheme: () => void;       // جابه‌جایی بین روشن و تاریک
}

// ══════════════════════════════════════════════════════════════
// Store احراز هویت
// persist یعنی: در localStorage مرورگر ذخیره کن
// با نام "clinic-auth" - بعد از بستن و باز کردن مرورگر هنوز هست
// ══════════════════════════════════════════════════════════════
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // مقادیر اولیه - کاربر لاگین نکرده
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      // این تابع بعد از لاگین موفق صدا زده میشه
      // توکن رو decode می‌کنه تا اطلاعات کاربر رو بگیره
      setTokens: (accessToken, refreshToken) => {
        try {
          // توکن JWT رو باز کن و اطلاعاتش رو بخون
          const decoded = jwtDecode<JwtPayload>(accessToken);

          // اطلاعات کاربر رو از توکن بساز
          const user: User = {
            id: decoded.nameid,
            username: decoded.unique_name,
            phone: decoded.mobilephone,
            fullName: decoded.fullName,
            fullNameEn: decoded.fullNameEn,
            role: decoded.role as User["role"],
            patientId: decoded.patientId,
          };

          // همه رو در Store ذخیره کن
          set({ accessToken, refreshToken, user, isAuthenticated: true });
        } catch {
          // اگه توکن خراب بود، همه چیز رو پاک کن
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
        }
      },

      // خروج از سیستم - همه اطلاعات رو پاک کن
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    { name: "clinic-auth" } // کلید ذخیره در localStorage
  )
);

// ══════════════════════════════════════════════════════════════
// Store تنظیمات برنامه
// اینجا چیزهایی مثل زبان و باز/بسته بودن منو ذخیره میشه
// ══════════════════════════════════════════════════════════════
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      lang: "fa",                                           // زبان پیش‌فرض: فارسی
      setLang: (lang) => set({ lang }),                     // تغییر زبان
      sidebarOpen: true,                                    // منو پیش‌فرض: باز
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })), // برعکس کردن حالت منو
      theme: "light",                                       // حالت پیش‌فرض: روشن
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    { name: "clinic-app" } // کلید ذخیره در localStorage
  )
);
