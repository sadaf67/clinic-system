// ══════════════════════════════════════════════════════════════
// صفحه پرونده‌های پزشکی (Medical Records)
//
// اینجا دکتر می‌تونه:
// - لیست همه ویزیت‌های انجام شده رو ببینه (به ترتیب جدیدترین)
// - جستجو کنه (با نام بیمار، تشخیص یا کد ICD)
// - ویزیت جدید ثبت کنه (با پر کردن فرم)
// - روی هر کارت کلیک کنه و به پرونده بیمار بره
//
// هر کارت نشون میده: نام بیمار، تاریخ ویزیت، تشخیص، علائم حیاتی
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { Search, FileText, Plus, ChevronRight, Activity } from "lucide-react";
import { medicalRecordApi } from "@/lib/api/axios";
import toast from "react-hot-toast";
import NewVisitModal from "@/components/forms/NewVisitModal";

export default function MedicalRecordsPage() {
  const { lang } = useAppStore();
  const t = useTranslations(lang);
  const router = useRouter();
  const [search, setSearch] = useState("");     // متن جستجو
  const [showForm, setShowForm] = useState(false); // نشون دادن فرم ویزیت جدید
  const [records, setRecords] = useState<any[]>([]);

  const load = async () => {
    try {
      const { data } = await medicalRecordApi.getAll();
      setRecords(data || []);
    } catch {
      setRecords([]);
      toast.error(lang === "fa" ? "دریافت پرونده‌ها ناموفق بود" : "Could not load medical records");
    }
  };

  useEffect(() => { load(); }, []);

  // ─── فیلتر کردن پرونده‌ها بر اساس جستجو ──────────────────────
  // روی سه فیلد جستجو می‌کنه: نام بیمار، تشخیص، کد ICD
  const filtered = records.filter(r =>
    (r.patientName || "").includes(search) ||
    (r.diagnosis || "").includes(search) ||
    (r.diagnosisCode || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان + دکمه ثبت ویزیت جدید ──────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav.medicalRecords}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {lang === "fa" ? `${filtered.length} پرونده` : `${filtered.length} records`}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {lang === "fa" ? "ثبت ویزیت جدید" : "New Visit"}
          </button>
        </div>

        {/* ─── فیلد جستجو ──────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === "fa" ? "جستجو با نام بیمار، تشخیص یا کد ICD..." : "Search by patient, diagnosis or ICD code..."}
            className="input-field ps-11" />
        </div>

        {/* ─── لیست پرونده‌ها ──────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">{t.common.noData}</div>
          ) : filtered.map(r => (
            // کارت هر پرونده - با کلیک به صفحه پرونده بیمار می‌ره
            <div key={r.id}
              onClick={() => router.push(`/admin/patients/${r.patientId}`)}
              className="card cursor-pointer hover:shadow-md transition-all group">
              <div className="flex items-start gap-4">

                {/* آیکون پرونده */}
                <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* ردیف اول: نام بیمار، تاریخ، کد ICD */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">{r.patientName}</span>
                    <span className="text-xs text-gray-400">
                      {/* تاریخ ویزیت به قالب "۱۵ خرداد ۱۴۰۳" یا "June 15, 2024" */}
                      {new Date(r.visitDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                    {r.diagnosisCode && (
                      // کد ICD-10 (مثلاً I10 = فشار خون) با فونت monospace
                      <span className="badge badge-blue font-mono text-xs">{r.diagnosisCode}</span>
                    )}
                  </div>

                  {/* تشخیص + شکایت اصلی */}
                  <div className="mt-1.5">
                    <span className="text-sm font-medium text-blue-700">{r.diagnosis}</span>
                    {r.chiefComplaint && (
                      <span className="text-xs text-gray-500 ms-2">— {r.chiefComplaint}</span>
                    )}
                  </div>

                  {/* علائم حیاتی به صورت chip (برچسب کوچک) */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {r.weight && (
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-lg px-2.5 py-1">
                        <Activity className="w-3 h-3" />
                        {lang === "fa" ? "وزن:" : "Wt:"} {r.weight}kg
                      </span>
                    )}
                    {r.bp && (
                      // فشار خون با پس‌زمینه قرمز کمرنگ
                      <span className="text-xs bg-red-50 text-red-600 rounded-lg px-2.5 py-1">
                        BP: {r.bp}
                      </span>
                    )}
                    {r.bloodSugar && (
                      // قند خون با پس‌زمینه بنفش
                      <span className="text-xs bg-purple-50 text-purple-600 rounded-lg px-2.5 py-1">
                        {lang === "fa" ? "قند:" : "BS:"} {r.bloodSugar}
                      </span>
                    )}
                    {r.nextVisitDate && (
                      // تاریخ ویزیت بعدی با پس‌زمینه سبز
                      <span className="text-xs bg-green-50 text-green-700 rounded-lg px-2.5 py-1">
                        {lang === "fa" ? "ویزیت بعدی:" : "Next:"}{" "}
                        {new Date(r.nextVisitDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* طرح درمان خلاصه - حداکثر یه خط */}
                  {r.treatmentPlan && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{r.treatmentPlan}</p>
                  )}
                </div>

                {/* فلش → وقتی hover کنی آبی میشه */}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition flex-shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── مودال ثبت ویزیت جدید ────────────────────────────── */}
      {showForm && <NewVisitModal lang={lang} t={t} onClose={() => setShowForm(false)} onSaved={load} />}
    </AdminLayout>
  );
}
