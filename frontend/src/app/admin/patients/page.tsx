// ══════════════════════════════════════════════════════════════
// صفحه لیست بیماران
//
// اینجا می‌تونی:
// - لیست همه بیماران رو ببینی (به شکل کارت)
// - جستجو کنی (با نام، کد ملی یا شماره موبایل)
// - بیمار جدید اضافه کنی (دکمه بالا)
// - روی هر کارت کلیک کنی تا پرونده کامل بیمار رو ببینی
// - بین صفحات جابجا بشی (صفحه‌بندی)
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { patientApi } from "@/lib/api/axios";
import { Search, UserPlus, Eye, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import NewPatientModal from "@/components/forms/NewPatientModal";

export default function PatientsPage() {
  const { lang } = useAppStore();           // زبان فعلی
  const t = useTranslations(lang);          // متن‌های ترجمه
  const router = useRouter();               // برای رفتن به صفحه جزئیات بیمار

  // State ها (اطلاعاتی که این صفحه نگه می‌داره)
  const [patients, setPatients] = useState<any[]>([]); // لیست بیماران
  const [total, setTotal] = useState(0);               // کل تعداد بیماران
  const [page, setPage] = useState(1);                 // صفحه فعلی (برای صفحه‌بندی)
  const [search, setSearch] = useState("");            // متن جستجو
  const [loading, setLoading] = useState(true);        // آیا داریم لود می‌کنیم؟
  const [showForm, setShowForm] = useState(false);     // نشون دادن مودال بیمار جدید

  // ─── تابع بارگذاری لیست بیماران از سرور ─────────────────────
  const load = async () => {
    setLoading(true);
    try {
      // به سرور درخواست بزن: بیماران صفحه X با این جستجو
      const res = await patientApi.getAll({ search: search || undefined, page, pageSize: 15 });
      setPatients(res.data.items || []);  // لیست بیماران این صفحه
      setTotal(res.data.total || 0);      // کل تعداد (برای صفحه‌بندی)
    } catch {
      setPatients([]);
      setTotal(0);
      toast.error(lang === "fa" ? "دریافت فهرست بیماران ناموفق بود" : "Could not load patients");
    } finally {
      setLoading(false);
    }
  };

  // وقتی جستجو عوض میشه، برگرد به صفحه اول
  // (وگرنه ممکنه توی صفحه ۳ باشی و نتیجه جستجو فقط ۱ صفحه داشته باشه)
  useEffect(() => { setPage(1); }, [search]);

  // ─── بارگذاری با تاخیر (Debounce) ────────────────────────────
  // به search و page هر دو وابسته است؛ هر بار کاربر تایپ می‌کنه یا صفحه عوض میشه
  // ۴۰۰ms صبر می‌کنیم بعد درخواست می‌فرستیم - برای هر حرف سرور صدا نمی‌زنیم
  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(timer); // اگه دوباره تغییر کرد، تایمر قبلی رو پاک کن
  }, [search, page]);

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان صفحه + دکمه بیمار جدید ──────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav.patients}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {/* نشون دادن تعداد کل بیماران - فارسی با ارقام فارسی */}
              {lang === "fa" ? `${total.toLocaleString("fa-IR")} بیمار ثبت شده` : `${total} registered patients`}
            </p>
          </div>
          {/* دکمه ثبت بیمار جدید */}
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t.patient.new}
          </button>
        </div>

        {/* ─── فیلد جستجو ──────────────────────────────────────── */}
        <div className="relative">
          {/* آیکون ذره‌بین داخل فیلد */}
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)} // هر بار کاربر تایپ کرد، search رو آپدیت کن
            placeholder={lang === "fa" ? "جستجو با نام، کد ملی یا موبایل..." : "Search by name, ID or phone..."}
            className="input-field ps-11" // ps-11 = padding کافی برای آیکون
          />
        </div>

        {/* ─── کارت‌های بیماران ────────────────────────────────── */}
        {/* ۱ ستون موبایل، ۲ ستون تبلت، ۳ ستون دسکتاپ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* در حال بارگذاری: ۶ کارت خاکستری متحرک */}
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse h-28 bg-gray-100" />
            ))
          ) : patients.length === 0 ? (
            // هیچ بیماری پیدا نشد
            <div className="col-span-3 text-center py-16 text-gray-400">{t.common.noData}</div>
          ) : patients.map(p => (
            // کارت هر بیمار - با کلیک به صفحه جزئیاتش می‌ره
            <div key={p.id} className="card hover:shadow-md transition-all cursor-pointer group"
              onClick={() => router.push(`/admin/patients/${p.id}`)}>
              <div className="flex items-start gap-3">

                {/* آواتار: حرف اول نام بیمار */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm">
                  {p.fullName?.[0] || "؟"}
                </div>

                <div className="flex-1 min-w-0">
                  {/* نام بیمار */}
                  <div className="font-semibold text-gray-900 truncate">{p.fullName}</div>

                  {/* شماره موبایل و سن */}
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span dir="ltr">{p.phoneNumber}</span>
                    <span>·</span>
                    <span>{lang === "fa" ? `${p.age} ساله` : `Age ${p.age}`}</span>
                  </div>

                  {/* گروه خونی، تعداد ویزیت، آخرین ویزیت */}
                  <div className="flex items-center gap-2 mt-2">
                    {p.bloodType && (
                      // badge قرمز برای گروه خونی
                      <span className="badge badge-red text-[10px] px-2 py-0.5">{p.bloodType}</span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {lang === "fa" ? `${p.totalVisits} ویزیت` : `${p.totalVisits} visits`}
                    </span>
                    {p.lastVisitDate && (
                      <span className="text-[10px] text-gray-400">
                        {/* تاریخ آخرین ویزیت به قالب ماه-روز */}
                        · {new Date(p.lastVisitDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* فلش کوچک سمت راست - وقتی hover کنی آبی میشه */}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition flex-shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>

        {/* ─── صفحه‌بندی ───────────────────────────────────────── */}
        {/* فقط نشون داده میشه اگه بیش از ۱۵ بیمار داشته باشیم */}
        {total > 15 && (
          <div className="flex items-center justify-center gap-2">
            {/* دکمه قبلی - غیرفعال وقتی صفحه اول هستیم */}
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition">
              {lang === "fa" ? "قبلی" : "Prev"}
            </button>
            <span className="text-sm text-gray-500 px-2">
              {lang === "fa" ? `صفحه ${page.toLocaleString("fa-IR")}` : `Page ${page}`}
            </span>
            {/* دکمه بعدی - غیرفعال وقتی صفحه آخر هستیم */}
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition">
              {lang === "fa" ? "بعدی" : "Next"}
            </button>
          </div>
        )}
      </div>

      {/* ─── مودال ثبت بیمار جدید ─────────────────────────────── */}
      {showForm && (
        <NewPatientModal
          lang={lang}
          t={t}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </AdminLayout>
  );
}
