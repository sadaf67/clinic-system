"use client";

// ══════════════════════════════════════════════════════════════
// فرم ثبت بیمار جدید (پنجره پاپ‌آپ) — برای پنل ادمین/منشی
//
// نکته مهم: بک‌اند مسیر مجزایی برای "ادمین یه بیمار بسازه" نداره —
// طبق کد UsersController، ساخت کاربر با نقش Patient اونجا رد میشه:
// «بیمار باید از مسیر ثبت‌نام بیمار ایجاد شود» — یعنی باید از همون
// اندپوینت /auth/register استفاده کنیم (دقیقاً همون که صفحه ثبت‌نام
// عمومی /register استفاده می‌کنه).
//
// این اندپوینت یه AuthResponse با توکن برای کاربر تازه‌ساز برمی‌گردونه؛
// چون این فرم داخل پنل ادمینه، عمداً setTokens/ورود به حساب بیمار رو
// انجام نمی‌دیم — فقط پیام موفقیت نشون می‌دیم و لیست رو رفرش می‌کنیم،
// تا نشست (session) خود ادمین دست‌نخورده بمونه.
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api/axios";

export default function NewPatientModal({
  lang, t, onClose, onSaved,
}: {
  lang: string;
  t: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    firstNameEn: "",
    lastNameEn: "",
    phoneNumber: "",
    nationalCode: "",
    dateOfBirth: "",
    gender: "1", // ۱=مرد، ۲=زن (هماهنگ با enum Gender در بک‌اند)
    password: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim() || !form.nationalCode.trim() || !form.dateOfBirth || !form.password) {
      toast.error(lang === "fa" ? "فیلدهای ستاره‌دار الزامی است" : "Please fill all required fields");
      return;
    }
    if (!/^09\d{9}$/.test(form.phoneNumber.trim())) {
      toast.error(lang === "fa" ? "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود" : "Mobile must be 11 digits starting with 09");
      return;
    }
    if (!/^\d{10}$/.test(form.nationalCode.trim())) {
      toast.error(lang === "fa" ? "کد ملی باید دقیقاً ۱۰ رقم باشد" : "National ID must be exactly 10 digits");
      return;
    }
    if (form.password.length < 8) {
      toast.error(lang === "fa" ? "رمز عبور باید حداقل ۸ کاراکتر باشد" : "Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      await authApi.register({
        firstName: form.firstName,
        lastName: form.lastName,
        firstNameEn: form.firstNameEn || null,
        lastNameEn: form.lastNameEn || null,
        phoneNumber: form.phoneNumber,
        nationalCode: form.nationalCode,
        dateOfBirth: form.dateOfBirth,
        gender: parseInt(form.gender, 10),
        password: form.password,
      });
      // عمداً توکن پاسخ رو ذخیره نمی‌کنیم — نشست ادمین باید دست‌نخورده بمونه
      toast.success(lang === "fa" ? "بیمار جدید ثبت شد" : "Patient registered");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "ثبت بیمار ناموفق بود" : "Could not register patient"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

        {/* هدر مودال */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{lang === "fa" ? "بیمار جدید" : "New Patient"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* نام فارسی + انگلیسی */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام" : "First Name"} *</label>
              <input value={form.firstName} onChange={set("firstName")} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام خانوادگی" : "Last Name"} *</label>
              <input value={form.lastName} onChange={set("lastName")} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام (انگلیسی)" : "First Name (EN)"}</label>
              <input value={form.firstNameEn} onChange={set("firstNameEn")} className="input-field text-sm" dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام خانوادگی (انگلیسی)" : "Last Name (EN)"}</label>
              <input value={form.lastNameEn} onChange={set("lastNameEn")} className="input-field text-sm" dir="ltr" />
            </div>
          </div>

          {/* موبایل + کد ملی */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "شماره موبایل" : "Mobile"} *</label>
              <input value={form.phoneNumber} onChange={set("phoneNumber")} dir="ltr" placeholder="09xxxxxxxxx" className="input-field text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "کد ملی" : "National ID"} *</label>
              <input value={form.nationalCode} onChange={set("nationalCode")} dir="ltr" maxLength={10} placeholder="10 digits" className="input-field text-sm" />
            </div>
          </div>

          {/* تاریخ تولد + جنسیت */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "تاریخ تولد" : "Date of Birth"} *</label>
              <input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")}
                max={new Date().toISOString().slice(0, 10)} className="input-field text-sm" dir="ltr" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "جنسیت" : "Gender"}</label>
              <select value={form.gender} onChange={set("gender")} className="input-field text-sm">
                <option value="1">{lang === "fa" ? "مرد" : "Male"}</option>
                <option value="2">{lang === "fa" ? "زن" : "Female"}</option>
              </select>
            </div>
          </div>

          {/* رمز عبور اولیه */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "رمز عبور اولیه" : "Initial Password"} *</label>
            <div className="relative">
              <input value={form.password} onChange={set("password")}
                type={showPass ? "text" : "password"} dir="ltr"
                className="input-field text-sm pe-10" placeholder="Min 8 chars" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute inset-y-0 end-3 flex items-center text-gray-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* دکمه‌های لغو/ذخیره */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button onClick={save} disabled={saving}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
