// ══════════════════════════════════════════════════════════════
// صفحه مدیریت کاربران (Users)
//
// اینجا سوپرادمین (دکتر) می‌تونه:
// - لیست همه کاربران رو ببینه (دکتر، منشی، بیمار)
// - کاربر جدید اضافه کنه (دکتر یا منشی)
// - کاربری رو فعال یا غیرفعال کنه
//
// نقش‌ها:
// SuperAdmin = دکتر (بالاترین دسترسی)
// Admin = منشی (دسترسی متوسط)
// Patient = بیمار (دسترسی کمتر - پرتال بیمار)
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api/axios";
import toast from "react-hot-toast";
import { UserPlus, Search, Shield, ShieldCheck, User, X, Eye, EyeOff } from "lucide-react";

// ─── اطلاعات نمایشی هر نقش ────────────────────────────────────
// هر نقش: متن فارسی، متن انگلیسی، رنگ badge، آیکون
const ROLE_LABELS: Record<string, { fa: string; en: string; badge: string; icon: React.ReactNode }> = {
  SuperAdmin: { fa: "پزشک / سوپر ادمین", en: "Doctor / Super Admin", badge: "badge-blue",  icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  Admin:      { fa: "منشی / ادمین",      en: "Secretary / Admin",    badge: "badge-green", icon: <Shield      className="w-3.5 h-3.5" /> },
  Patient:    { fa: "بیمار",             en: "Patient",              badge: "badge-gray",  icon: <User        className="w-3.5 h-3.5" /> },
};

interface UserRow {
  id: string;
  fullName: string;
  fullNameEn: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersAdminPage() {
  const { lang } = useAppStore();
  const t = useTranslations(lang);

  const [search, setSearch] = useState("");          // متن جستجو
  const [showForm, setShowForm] = useState(false);   // نشون دادن مودال کاربر جدید
  const [users, setUsers] = useState<UserRow[]>([]); // لیست کاربران
  const [loading, setLoading] = useState(true);      // تا وقتی لیست نیومده

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/users", { params: { search: search || undefined, pageSize: 100 } });
        setUsers((data.items || []).map((u: any) => ({
          id: u.id,
          fullName: u.fullName,
          fullNameEn: u.fullNameEn,
          phone: u.phoneNumber || "",
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
        })));
      } catch {
        setUsers([]);
        toast.error(lang === "fa" ? "دریافت کاربران ناموفق بود" : "Could not load users");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, lang]);

  // جستجو سمت سرور انجام میشه (params.search)؛
  // فیلتر دوباره در سمت کلاینت باعث می‌شد نتیجه‌های درست هم مخفی بشن.

  // ─── فعال/غیرفعال کردن کاربر ────────────────────────────────
  const toggleActive = async (id: string) => {
    try {
      const { data } = await api.patch(`/users/${id}/toggle-active`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: data.isActive } : u));
      toast.success(lang === "fa" ? "وضعیت بروزرسانی شد" : "Status updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "بروزرسانی وضعیت ناموفق بود" : "Status update failed"));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان + دکمه کاربر جدید ────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav.users}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {lang === "fa" ? "مدیریت کاربران و دسترسی‌ها" : "Manage users and access levels"}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {lang === "fa" ? "کاربر جدید" : "New User"}
          </button>
        </div>

        {/* ─── فیلد جستجو ──────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === "fa" ? "جستجوی نام یا شماره موبایل..." : "Search name or phone..."}
            className="input-field ps-11" />
        </div>

        {/* ─── کارت‌های آمار نقش‌ها ─────────────────────────────── */}
        {/* تعداد هر نقش به صورت کارت */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(ROLE_LABELS).map(([role, info]) => {
            const count = users.filter(u => u.role === role).length; // شمارش
            return (
              <div key={role} className="card flex items-center gap-3">
                {/* آیکون رنگی بر اساس نقش */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  role === "SuperAdmin" ? "bg-blue-50 text-blue-600" :
                  role === "Admin" ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-600"
                }`}>
                  {info.icon}
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">{lang === "fa" ? info.fa : info.en}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── جدول کاربران ────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-start">{lang === "fa" ? "کاربر" : "User"}</th>
                  <th className="text-start">{lang === "fa" ? "موبایل" : "Mobile"}</th>
                  <th className="text-start">{lang === "fa" ? "نقش" : "Role"}</th>
                  <th className="text-start">{lang === "fa" ? "تاریخ عضویت" : "Joined"}</th>
                  <th className="text-start">{lang === "fa" ? "وضعیت" : "Status"}</th>
                  <th className="text-start">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {/* حالت بارگذاری: ردیف‌های اسکلتی */}
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 bg-gray-100 rounded" />
                          <div className="h-2.5 w-16 bg-gray-100 rounded" />
                        </div>
                      </div>
                    </td>
                    <td><div className="h-3 w-24 bg-gray-100 rounded" /></td>
                    <td><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                    <td><div className="h-3 w-16 bg-gray-100 rounded" /></td>
                    <td><div className="h-5 w-12 bg-gray-100 rounded-full" /></td>
                    <td><div className="h-6 w-16 bg-gray-100 rounded-lg" /></td>
                  </tr>
                ))}

                {/* هیچ کاربری پیدا نشد */}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mb-3">
                          <User className="w-6 h-6" />
                        </div>
                        <p className="text-gray-900 font-medium">
                          {search
                            ? (lang === "fa" ? "کاربری با این مشخصات پیدا نشد" : "No user matched your search")
                            : (lang === "fa" ? "هنوز کاربری ثبت نشده است" : "No users yet")}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && users.map(u => (
                  <tr key={u.id}>
                    {/* ستون کاربر: آواتار + نام فارسی + نام انگلیسی */}
                    <td>
                      <div className="flex items-center gap-3">
                        {/* آواتار رنگی بر اساس نقش */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                          u.role === "SuperAdmin" ? "bg-blue-600" :
                          u.role === "Admin" ? "bg-green-600" : "bg-gray-500"
                        }`}>
                          {(u.fullName || u.fullNameEn || "؟").trim().charAt(0) || "؟"} {/* حرف اول نام */}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{u.fullName}</div>
                          <div className="text-xs text-gray-400">{u.fullNameEn}</div>
                        </div>
                      </div>
                    </td>
                    {/* شماره موبایل - همیشه ltr */}
                    <td className="text-sm text-gray-600 tabular-nums" dir="ltr">{u.phone}</td>
                    {/* نقش با badge */}
                    <td>
                      <span className={`badge flex items-center gap-1 w-fit ${ROLE_LABELS[u.role]?.badge}`}>
                        {ROLE_LABELS[u.role]?.icon}
                        {lang === "fa" ? ROLE_LABELS[u.role]?.fa : ROLE_LABELS[u.role]?.en}
                      </span>
                    </td>
                    {/* تاریخ عضویت */}
                    <td className="text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    </td>
                    {/* وضعیت فعال/غیرفعال */}
                    <td>
                      <span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>
                        {u.isActive ? (lang === "fa" ? "فعال" : "Active") : (lang === "fa" ? "غیرفعال" : "Inactive")}
                      </span>
                    </td>
                    {/* دکمه فعال/غیرفعال کردن */}
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleActive(u.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition ${
                            u.isActive
                              ? "bg-red-50 text-red-600 hover:bg-red-100"      // فعاله → دکمه قرمز "غیرفعال کن"
                              : "bg-green-50 text-green-600 hover:bg-green-100" // غیرفعاله → دکمه سبز "فعال کن"
                          }`}>
                          {u.isActive ? (lang === "fa" ? "غیرفعال" : "Deactivate") : (lang === "fa" ? "فعال" : "Activate")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── مودال کاربر جدید ──────────────────────────────────── */}
      {showForm && (
        <NewUserModal
          lang={lang} t={t}
          onClose={() => setShowForm(false)}
          // بعد از ذخیره: کاربر جدید رو به لیست اضافه کن
          onSave={(u: UserRow) => { setUsers(prev => [u, ...prev]); setShowForm(false); }}
        />
      )}
    </AdminLayout>
  );
}

// ══════════════════════════════════════════════════════════════
// فرم اضافه کردن کاربر جدید (مودال)
// ══════════════════════════════════════════════════════════════
function NewUserModal({ lang, t, onClose, onSave }: { lang: string; t: any; onClose: () => void; onSave: (user: UserRow) => void }) {
  // فیلدهای فرم
  const [form, setForm] = useState({
    firstName: "",    // نام فارسی
    lastName: "",     // نام خانوادگی فارسی
    firstNameEn: "",  // نام انگلیسی
    lastNameEn: "",   // نام خانوادگی انگلیسی
    phone: "",        // شماره موبایل
    role: "Admin",    // نقش پیش‌فرض: منشی
    password: ""      // رمز اولیه
  });
  const [showPass, setShowPass] = useState(false); // نشون دادن/مخفی کردن رمز
  const [saving, setSaving] = useState(false);     // جلوگیری از ثبت دوباره

  // helper برای آپدیت هر فیلد
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ─── ذخیره کاربر جدید ─────────────────────────────────────
  const save = async () => {
    // اگه فیلدهای اجباری خالی باشن، به کاربر بگو (قبلاً دکمه بی‌صدا کار نمی‌کرد)
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.password) {
      toast.error(lang === "fa" ? "فیلدهای ستاره‌دار الزامی است" : "Please fill all required fields");
      return;
    }
    if (!/^09\d{9}$/.test(form.phone.trim())) {
      toast.error(lang === "fa" ? "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود" : "Mobile must be 11 digits starting with 09");
      return;
    }
    if (form.password.length < 8) {
      toast.error(lang === "fa" ? "رمز عبور باید حداقل ۸ کاراکتر باشد" : "Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post("/users", {
        firstName: form.firstName,
        lastName: form.lastName,
        firstNameEn: form.firstNameEn || null,
        lastNameEn: form.lastNameEn || null,
        phoneNumber: form.phone,
        password: form.password,
        role: form.role,
      });

      onSave({
        id: data.id,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        fullNameEn: `${form.firstNameEn} ${form.lastNameEn}`.trim(),
        phone: data.phoneNumber || form.phone,
        role: data.role || form.role,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      toast.success(lang === "fa" ? "کاربر ایجاد شد" : "User created");
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.response?.data?.errors?.join?.(", ");
      toast.error(message || (lang === "fa" ? "ایجاد کاربر ناموفق بود" : "Could not create user"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

        {/* هدر مودال */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{lang === "fa" ? "کاربر جدید" : "New User"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* نام فارسی + انگلیسی */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام (فارسی)" : "First Name (FA)"} *</label>
              <input value={form.firstName} onChange={set("firstName")} className="input-field text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نام خانوادگی (فارسی)" : "Last Name (FA)"} *</label>
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

          {/* شماره موبایل */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "شماره موبایل" : "Mobile"} *</label>
            <input value={form.phone} onChange={set("phone")} dir="ltr" placeholder="09xxxxxxxxx" className="input-field text-sm" />
          </div>

          {/* انتخاب نقش */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "نقش" : "Role"} *</label>
            <select value={form.role} onChange={set("role")} className="input-field text-sm">
              <option value="Admin">{lang === "fa" ? "منشی / ادمین" : "Secretary / Admin"}</option>
              <option value="SuperAdmin">{lang === "fa" ? "پزشک / سوپر ادمین" : "Doctor / Super Admin"}</option>
              {/* بیمار از اینجا اضافه نمیشه - باید از صفحه ثبت‌نام بره */}
            </select>
          </div>

          {/* رمز عبور اولیه */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "رمز عبور اولیه" : "Initial Password"} *</label>
            <div className="relative">
              <input value={form.password} onChange={set("password")}
                type={showPass ? "text" : "password"} dir="ltr"
                className="input-field text-sm pe-10" placeholder="Min 8 chars" />
              {/* دکمه نشان دادن/مخفی کردن رمز */}
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
