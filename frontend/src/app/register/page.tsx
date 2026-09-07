"use client";

// ══════════════════════════════════════════════════════════════
// صفحه ثبت‌نام بیمار (Register Page)
//
// این صفحه یه فرم دو مرحله‌ای داره:
// مرحله ۱: اطلاعات شخصی (نام، موبایل، کد ملی، تولد، جنسیت)
// مرحله ۲: رمز عبور + تأیید رمز
//
// بعد از ثبت‌نام موفق، توکن‌ها ذخیره میشن و
// بیمار به /portal میره
// ══════════════════════════════════════════════════════════════

// useState = برای نگه‌داشتن مقادیر محلی (مثل "آیا در حال بارگذاری؟")
import { useState, useEffect } from "react";

// useRouter = برای رفتن به صفحه دیگه بعد از ثبت‌نام
import { useRouter } from "next/navigation";

// Link = رفتن به صفحه ورود بدون بارگذاری کامل صفحه
import Link from "next/link";

// useForm = کتابخونه مدیریت فرم‌ها
import { useForm } from "react-hook-form";

// zodResolver = اعتبارسنجی فرم رو به Zod وصل می‌کنه
import { zodResolver } from "@hookform/resolvers/zod";

// z = کتابخونه Zod برای تعریف قوانین اعتبارسنجی
import { z } from "zod";

// toast = پیغام‌های کوچیک گوشه صفحه ("ثبت‌نام موفق" / "خطا")
import toast from "react-hot-toast";

// authApi = توابع API مربوط به احراز هویت
import { authApi } from "@/lib/api/axios";

// استورهای Zustand برای ذخیره توکن و تنظیمات زبان
import { useAuthStore, useAppStore } from "@/store/useStore";

// تشخیص اینکه اطلاعات لاگین از localStorage خونده شده یا نه
import { useAuthHydrated } from "@/lib/hooks/useHydrated";

// آیکون‌های لوسید
import { Globe, Stethoscope, Eye, EyeOff, ChevronLeft } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// schema: قوانین اعتبارسنجی فرم با کتابخونه Zod
// هر فیلد یه قانون داره — اگه کاربر اشتباه وارد کنه، پیغام خطا نشون داده میشه
// ──────────────────────────────────────────────────────────────
// پیام خطاها به صورت «کلید» ذخیره میشن تا موقع نمایش،
// بسته به زبان انتخابی ترجمه بشن (قبلاً همیشه فارسی نشون داده می‌شد)
const schema = z.object({
  firstName:       z.string().min(2),                              // حداقل ۲ حرف
  lastName:        z.string().min(2),                              // حداقل ۲ حرف
  phoneNumber:     z.string().regex(/^09\d{9}$/, "invalidPhone"),  // باید 09xxxxxxxxx باشه
  nationalCode:    z.string().regex(/^\d{10}$/, "invalidNationalCode"), // دقیقاً ۱۰ رقم
  dateOfBirth:     z.string().min(1),                              // خالی نباشه
  gender:          z.enum(["1", "2"]),                             // فقط ۱ (مرد) یا ۲ (زن)
  password:        z.string().min(8, "shortPassword"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  // ← تأیید می‌کنه که رمز و تکرارش یکیه
  message: "passwordMismatch",
  path: ["confirmPassword"], // خطا روی فیلد confirmPassword نشون داده میشه
});

// ترجمه کلیدهای بالا
const ERROR_TEXT: Record<string, { fa: string; en: string }> = {
  invalidPhone:        { fa: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود", en: "Mobile must be 11 digits starting with 09" },
  invalidNationalCode: { fa: "کد ملی باید ۱۰ رقم عددی باشد",              en: "National ID must be 10 digits" },
  shortPassword:       { fa: "رمز عبور باید حداقل ۸ کاراکتر باشد",        en: "Password must be at least 8 characters" },
  passwordMismatch:    { fa: "رمز عبور و تکرار آن یکسان نیستند",          en: "Passwords do not match" },
};

// نوع TypeScript از روی schema استخراج میشه — دیگه دستی تعریف نمی‌کنیم
type FormData = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────────
// RegisterPage: کامپوننت اصلی صفحه ثبت‌نام
// ──────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, isAuthenticated, user } = useAuthStore(); // برای ذخیره توکن بعد از ثبت‌نام
  const { lang, setLang } = useAppStore();    // برای مدیریت زبان
  const hydrated = useAuthHydrated();         // آیا اطلاعات لاگین از حافظه خونده شده؟

  // اگه کاربر از قبل لاگین کرده، فرم ثبت‌نام رو نشونش نده
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    router.replace(user?.role === "Patient" ? "/portal" : "/admin/dashboard");
  }, [hydrated, isAuthenticated, user?.role, router]);
  const [showPass, setShowPass] = useState(false);       // نشون دادن/مخفی کردن رمز
  const [loading, setLoading] = useState(false);         // آیا داریم منتظر API هستیم؟
  const [step, setStep] = useState<1 | 2>(1);            // مرحله فعلی فرم (۱ یا ۲)

  // useForm: مدیریت کامل فرم — ثبت فیلدها، اعتبارسنجی، خطاها
  const { register, handleSubmit, trigger, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema), // ← اعتبارسنجی از روی schema
  });

  // watch (نه getValues) تا نوار قدرت رمز همزمان با تایپ به‌روز بشه
  const passwordValue = watch("password") || "";

  // ترجمه پیام خطای zod بر اساس زبان فعلی
  const errText = (key?: string) => {
    if (!key) return "";
    const entry = ERROR_TEXT[key];
    return entry ? (lang === "fa" ? entry.fa : entry.en) : key;
  };

  // ── nextStep: رفتن از مرحله ۱ به مرحله ۲ ────────────────
  // قبل از رفتن به مرحله بعد، فیلدهای مرحله ۱ رو اعتبارسنجی می‌کنه
  const nextStep = async () => {
    const valid = await trigger(["firstName", "lastName", "phoneNumber", "nationalCode", "dateOfBirth", "gender"]);
    if (valid) setStep(2); // فقط اگه همه فیلدها درست بودن، برو مرحله ۲
  };

  // ── onSubmit: ارسال فرم به API ────────────────────────────
  // این تابع وقتی دکمه "ثبت‌نام" زده میشه اجرا میشه
  const onSubmit = async (data: FormData) => {
    setLoading(true); // دکمه رو غیرفعال کن و اسپینر نشون بده
    try {
      // ارسال اطلاعات به API
      const res = await authApi.register({
        firstName:   data.firstName,
        lastName:    data.lastName,
        phoneNumber: data.phoneNumber,
        nationalCode:data.nationalCode,
        dateOfBirth: data.dateOfBirth,
        gender:      parseInt(data.gender), // "1"/"2" رو به عدد تبدیل می‌کنه
        password:    data.password,
      });

      // توکن‌های دریافتی رو توی استور ذخیره می‌کنه
      setTokens(res.data.accessToken, res.data.refreshToken);

      // پیغام موفقیت نشون بده
      toast.success(lang === "fa" ? "ثبت‌نام موفق!" : "Registered successfully!");

      // به پنل بیمار برو
      router.push("/portal");
    } catch (err: any) {
      // اگه API خطا برگردوند، پیغام خطا نشون بده
      toast.error(err?.response?.data?.message || (lang === "fa" ? "خطا در ثبت‌نام" : "Registration failed"));
    } finally {
      setLoading(false); // در هر حال، اسپینر رو خاموش کن
    }
  };

  // کوتاه‌نویسی برای اینکه هر بار lang === "fa" ننویسیم
  const fa = lang === "fa";

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 ${fa ? "rtl" : "ltr"}`}
      dir={fa ? "rtl" : "ltr"}
    >
      {/* ── دکمه تغییر زبان (گوشه بالا) ───────────────────── */}
      <div className="absolute top-6 end-6">
        <button
          onClick={() => setLang(fa ? "en" : "fa")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <Globe className="w-4 h-4" />
          {fa ? "English" : "فارسی"}
        </button>
      </div>

      <div className="w-full max-w-md">

        {/* ── لوگو و عنوان صفحه ─────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {fa ? "ثبت‌نام در سیستم" : "Patient Registration"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {fa ? "ایجاد حساب کاربری بیمار" : "Create your patient account"}
          </p>
        </div>

        {/* ── نشانگر مرحله (Step Indicator) ─────────────────────
            ۲ دایره کوچیک نشون میده کجای فرم هستیم
            وقتی مرحله ۲ هستیم، دایره اول آبی میشه
        ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              {/* دایره شماره مرحله */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                {s}
              </div>
              {/* نام مرحله */}
              <span className={`text-sm ${step >= s ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                {s === 1 ? (fa ? "اطلاعات شخصی" : "Personal Info") : (fa ? "امنیت" : "Security")}
              </span>
              {/* خط بین مرحله ۱ و ۲ — آبی میشه وقتی مرحله ۲ هستیم */}
              {s === 1 && <div className={`flex-1 h-0.5 ${step === 2 ? "bg-blue-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* ── فرم اصلی ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">

            {/* ════ مرحله ۱: اطلاعات شخصی ════ */}
            {step === 1 && (
              <>
                {/* نام و نام خانوادگی — دو ستونه */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "نام" : "First Name"} *</label>
                    <input {...register("firstName")} className="input-field text-sm" />
                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{fa ? "نام الزامی است" : "Required"}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "نام خانوادگی" : "Last Name"} *</label>
                    <input {...register("lastName")} className="input-field text-sm" />
                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{fa ? "نام خانوادگی الزامی است" : "Required"}</p>}
                  </div>
                </div>

                {/* شماره موبایل — dir="ltr" چون اعداد چپ به راستن */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "شماره موبایل" : "Mobile"} *</label>
                  <input {...register("phoneNumber")} dir="ltr" placeholder="09xxxxxxxxx" className="input-field text-sm" />
                  {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errText(errors.phoneNumber.message)}</p>}
                </div>

                {/* کد ملی — دقیقاً ۱۰ رقم */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "کد ملی" : "National ID"} *</label>
                  <input {...register("nationalCode")} dir="ltr" maxLength={10} placeholder="10 digits" className="input-field text-sm" />
                  {errors.nationalCode && <p className="text-red-500 text-xs mt-1">{errText(errors.nationalCode.message)}</p>}
                </div>

                {/* تاریخ تولد و جنسیت — دو ستونه */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "تاریخ تولد" : "Date of Birth"} *</label>
                    {/* max = امروز؛ تاریخ تولدِ آینده معنی نداره */}
                    <input {...register("dateOfBirth")} type="date" dir="ltr"
                      max={new Date().toISOString().slice(0, 10)}
                      className="input-field text-sm" />
                    {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{fa ? "الزامی است" : "Required"}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "جنسیت" : "Gender"} *</label>
                    <select {...register("gender")} className="input-field text-sm">
                      <option value="">{fa ? "انتخاب کنید" : "Select"}</option>
                      <option value="1">{fa ? "مرد" : "Male"}</option>
                      <option value="2">{fa ? "زن" : "Female"}</option>
                    </select>
                    {errors.gender && <p className="text-red-500 text-xs mt-1">{fa ? "الزامی است" : "Required"}</p>}
                  </div>
                </div>

                {/* دکمه "ادامه" — اعتبارسنجی مرحله ۱ رو چک می‌کنه */}
                <button type="button" onClick={nextStep} className="btn-primary w-full py-3 mt-2">
                  {fa ? "ادامه" : "Continue"}
                </button>
              </>
            )}

            {/* ════ مرحله ۲: رمز عبور ════ */}
            {step === 2 && (
              <>
                {/* رمز عبور با دکمه نشان/مخفی */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "رمز عبور" : "Password"} *</label>
                  <div className="relative">
                    {/* type تغییر می‌کنه بین "password" و "text" */}
                    <input
                      {...register("password")}
                      type={showPass ? "text" : "password"}
                      dir="ltr"
                      placeholder={fa ? "حداقل ۸ کاراکتر" : "At least 8 characters"}
                      className="input-field text-sm pe-11"
                    />
                    {/* دکمه چشم — نشون/مخفی کردن رمز */}
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute inset-y-0 end-3 flex items-center text-gray-400"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errText(errors.password.message)}</p>}
                </div>

                {/* تکرار رمز عبور */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{fa ? "تکرار رمز عبور" : "Confirm Password"} *</label>
                  <input
                    {...register("confirmPassword")}
                    type="password"
                    dir="ltr"
                    placeholder="••••••••"
                    className="input-field text-sm"
                  />
                  {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errText(errors.confirmPassword.message)}</p>}
                </div>

                {/* ── نشانگر قدرت رمز عبور ─────────────────────
                    یه کامپوننت کوچیک که نشون میده رمز چقدر قویه
                    getValues("password") = رمز فعلی رو می‌خونه
                ───────────────────────────────────────────────── */}
                <PasswordStrength password={passwordValue} fa={fa} />

                {/* متن قوانین */}
                <div className="text-xs text-gray-500 bg-blue-50 rounded-xl p-3">
                  {fa
                    ? "با ثبت‌نام، شما با قوانین و مقررات سیستم مدیریت کلینیک موافقت می‌کنید."
                    : "By registering, you agree to the clinic management system terms and conditions."}
                </div>

                {/* دکمه‌های برگشت و ثبت‌نام */}
                <div className="flex gap-2">
                  {/* برگشت به مرحله ۱ */}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex items-center gap-1.5 text-sm px-4"
                  >
                    {/* در حالت راست‌به‌چپ، فلش باید برعکس بشه */}
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    {fa ? "قبلی" : "Back"}
                  </button>

                  {/* دکمه ثبت‌نام نهایی */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {/* اسپینر چرخشی وقتی در حال ارسال هستیم */}
                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {fa ? "ثبت‌نام" : "Register"}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>

        {/* لینک به صفحه ورود */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {fa ? "حساب کاربری دارید؟ " : "Already have an account? "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            {fa ? "وارد شوید" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PasswordStrength: کامپوننت نشانگر قدرت رمز عبور
//
// ۴ معیار چک می‌کنه:
// ۱. طول >= 8 کاراکتر
// ۲. حروف بزرگ (A-Z)
// ۳. اعداد (0-9)
// ۴. کاراکتر خاص (!@#$...)
// score = تعداد معیارهایی که رمز داره (0 تا 4)
// ──────────────────────────────────────────────────────────────
function PasswordStrength({ password, fa }: { password: string; fa: boolean }) {
  // چک کردن هر معیار — .filter(Boolean) فقط trueها رو نگه میداره
  const score = [
    password.length >= 8,           // معیار ۱: طول کافی
    /[A-Z]/.test(password),         // معیار ۲: حروف بزرگ
    /[0-9]/.test(password),         // معیار ۳: اعداد
    /[^A-Za-z0-9]/.test(password),  // معیار ۴: کاراکترهای خاص
  ].filter(Boolean).length;

  // متن‌های فارسی/انگلیسی برای هر سطح قدرت
  const labels = fa
    ? ["خیلی ضعیف", "ضعیف", "متوسط", "قوی"]
    : ["Very Weak", "Weak", "Medium", "Strong"];

  // رنگ هر سطح — قرمز تا سبز
  const colors = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"];

  // اگه رمز خالیه، هیچی نشون نده
  if (!password) return null;

  return (
    <div className="space-y-1">
      {/* ۴ نوار کوچیک — هر چقدر score بیشتره، نوارهای بیشتری رنگی میشن */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? colors[score - 1] : "bg-gray-200"}`}
          />
        ))}
      </div>
      {/* متن توضیح سطح رمز */}
      <p className={`text-xs ${score < 2 ? "text-red-500" : score < 3 ? "text-yellow-600" : "text-green-600"}`}>
        {labels[score - 1] || ""}
      </p>
    </div>
  );
}
