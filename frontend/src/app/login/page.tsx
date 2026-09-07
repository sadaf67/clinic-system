// ══════════════════════════════════════════════════════════════
// صفحه لاگین (ورود به سیستم)
// این صفحه دو قسمت داره:
// - سمت چپ: معرفی سیستم (فقط روی صفحه‌های بزرگ نشون داده میشه)
// - سمت راست: فرم ورود (شماره موبایل + رمز عبور)
//
// "use client" = این صفحه در مرورگر اجرا میشه (نه سرور)
// چون از useState و رویدادها استفاده می‌کنیم
// ══════════════════════════════════════════════════════════════
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // برای هدایت کاربر بعد از لاگین
import Link from "next/link";                 // لینک بدون بارگذاری دوباره صفحه
import { useForm } from "react-hook-form";   // مدیریت فرم
import { zodResolver } from "@hookform/resolvers/zod"; // اعتبارسنجی با zod
import { z } from "zod";                     // کتابخونه اعتبارسنجی
import toast from "react-hot-toast";          // پیام‌های flash (موفق/خطا)
import { authApi } from "@/lib/api/axios";   // API لاگین
import { useAuthStore, useAppStore } from "@/store/useStore"; // حافظه مرکزی
import { useTranslations } from "@/lib/i18n"; // ترجمه‌ها (فارسی/انگلیسی)
import { useAuthHydrated } from "@/lib/hooks/useHydrated";
import { Eye, EyeOff, Stethoscope, Globe, CalendarCheck, FileHeart, MessageSquare, BellRing } from "lucide-react"; // آیکون‌ها

// ─── اعتبارسنجی فرم با Zod ────────────────────────────────────
// مثل تعریف قانون: نام کاربری نباید خالی باشه، رمز حداقل ۶ کاراکتر
const schema = z.object({
  userName: z.string().min(1),   // نام کاربری: اجباری
  password: z.string().min(6),   // رمز: حداقل ۶ کاراکتر
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();

  // از Store اطلاعات می‌خونیم
  const { setTokens, isAuthenticated, user } = useAuthStore(); // ذخیره توکن + وضعیت فعلی
  const { lang, setLang } = useAppStore();       // زبان فعلی و تابع تغییرش

  const t = useTranslations(lang); // بسته به زبان، متن‌های درست رو میده
  const hydrated = useAuthHydrated(); // آیا اطلاعات لاگین از حافظه خونده شده؟

  // State های محلی این صفحه
  const [showPass, setShowPass] = useState(false); // نشون دادن / مخفی کردن رمز
  const [loading, setLoading] = useState(false);   // آیا داریم صبر می‌کنیم؟

  // ─── اگه از قبل لاگین کرده، نذار دوباره فرم ورود ببینه ────
  // مستقیم ببرش به پنل خودش
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    router.replace(user?.role === "Patient" ? "/portal" : "/admin/dashboard");
  }, [hydrated, isAuthenticated, user?.role, router]);

  // تنظیم فرم با react-hook-form
  // zodResolver = اعتبارسنجی رو به schema می‌ده
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  // ─── تابع ارسال فرم ───────────────────────────────────────────
  const onSubmit = async (data: LoginForm) => {
    setLoading(true); // دکمه رو غیرفعال کن تا دوباره کلیک نشه
    try {
      // به سرور اطلاعات لاگین رو بفرست
      const res = await authApi.login(data);

      // توکن‌های دریافتی رو در حافظه ذخیره کن
      setTokens(res.data.accessToken, res.data.refreshToken);

      // پیام موفقیت نشون بده
      toast.success(lang === "fa" ? "ورود موفق" : "Login successful");

      // بسته به نقش، کاربر رو به جای درست هدایت کن
      const role = res.data.user.role;
      router.push(role === "Patient" ? "/portal" : "/admin/dashboard");
      // بیمار → پرتال بیمار | دکتر/منشی → پنل مدیریت

    } catch (err: any) {
      // پیغام خطای سرور رو نشون بده (یا پیام پیش‌فرض)
      toast.error(err?.response?.data?.message || (lang === "fa" ? "خطا در ورود" : "Login failed"));
    } finally {
      setLoading(false); // در هر صورت دکمه رو دوباره فعال کن
    }
  };

  return (
    // صفحه رو به دو ستون تقسیم می‌کنیم
    // dir = جهت متن: rtl برای فارسی، ltr برای انگلیسی
    <div className={`min-h-screen flex ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

      {/* ─── پنل چپ: معرفی سیستم ─────────────────────────────── */}
      {/* hidden lg:flex = روی موبایل مخفی، روی صفحه بزرگ نشون داده میشه */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col items-center justify-center p-12 text-white">
        {/* لوگو */}
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-8 backdrop-blur">
          <Stethoscope className="w-10 h-10" />
        </div>

        {/* عنوان سیستم */}
        <h1 className="text-4xl font-bold mb-4 text-center">
          {lang === "fa" ? "سیستم مدیریت کلینیک" : "Clinic Management System"}
        </h1>

        {/* توضیح کوتاه */}
        <p className="text-blue-200 text-center text-lg leading-relaxed max-w-sm">
          {lang === "fa"
            ? "مدیریت هوشمند نوبت، پرونده پزشکی، نسخه و مشاوره آنلاین"
            : "Smart management of appointments, medical records, prescriptions & online consultations"}
        </p>

        {/* امکانات سیستم */}
        {/* عمداً به جای آمار (مثلاً «۱۰۰+ بیمار») امکانات رو نشون میدیم؛ */}
        {/* عددی که واقعی نباشه، اولین سؤالی می‌شه که مخاطب می‌پرسه */}
        <div className="mt-12 grid grid-cols-2 gap-3 w-full max-w-sm">
          {[
            { icon: <CalendarCheck className="w-5 h-5" />, label: lang === "fa" ? "مدیریت نوبت‌دهی" : "Appointment Booking" },
            { icon: <FileHeart className="w-5 h-5" />, label: lang === "fa" ? "پرونده الکترونیک" : "Electronic Records" },
            { icon: <MessageSquare className="w-5 h-5" />, label: lang === "fa" ? "مشاوره آنلاین" : "Online Consultation" },
            { icon: <BellRing className="w-5 h-5" />, label: lang === "fa" ? "یادآوری پیامکی" : "SMS Reminders" },
          ].map(item => (
            <div key={item.label} className="bg-white/10 rounded-2xl p-4 backdrop-blur flex flex-col items-center text-center gap-2">
              <span className="text-blue-100">{item.icon}</span>
              <div className="text-blue-50 text-sm leading-snug">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── پنل راست: فرم لاگین ──────────────────────────────── */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">

        {/* دکمه تغییر زبان (گوشه بالا) */}
        <div className="absolute top-6 end-6">
          <button
            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <Globe className="w-4 h-4" />
            {lang === "fa" ? "English" : "فارسی"}
          </button>
        </div>

        <div className="w-full max-w-md">
          {/* سرتیتر فرم */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">{t.auth.loginTitle}</h2>
            <p className="text-gray-500 mt-2">
              {lang === "fa" ? "لطفاً اطلاعات خود را وارد کنید" : "Please enter your credentials"}
            </p>
          </div>

          {/* فرم لاگین */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* فیلد شماره موبایل / نام کاربری */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.auth.username}</label>
              <input
                {...register("userName")} // وصل کردن به react-hook-form
                placeholder={lang === "fa" ? "مثال: 09120000000" : "e.g. 09120000000"}
                className="input-field"
                dir="ltr" // شماره همیشه چپ‌به‌راست
              />
              {/* پیام خطا اگه خالی بود */}
              {errors.userName && <p className="text-red-500 text-xs mt-1">
                {lang === "fa" ? "وارد کردن نام کاربری الزامی است" : "Username is required"}
              </p>}
            </div>

            {/* فیلد رمز عبور */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.auth.password}</label>
              <div className="relative">
                {/* type رو بر اساس showPass عوض می‌کنیم */}
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="input-field pe-11"
                  dir="ltr"
                />
                {/* دکمه نشان دادن/مخفی کردن رمز */}
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">
                {lang === "fa" ? "رمز عبور باید حداقل ۶ کاراکتر باشد" : "Password must be at least 6 characters"}
              </p>}
            </div>

            {/* دکمه ورود */}
            <button
              type="submit"
              disabled={loading} // وقتی loading هست غیرفعال میشه
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {/* اگه loading هست، یه چرخشی نشون بده */}
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {lang === "fa" ? "در حال ورود..." : "Signing in..."}
                </span>
              ) : t.auth.login}
            </button>

            {/* لینک به صفحه ثبت‌نام */}
            <p className="text-center text-sm text-gray-500 mt-4">
              {lang === "fa" ? "حساب کاربری ندارید؟ " : "Don't have an account? "}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">
                {t.auth.register}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
