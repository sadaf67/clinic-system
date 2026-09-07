// ══════════════════════════════════════════════════════════════
// صفحه مشاوره‌های آنلاین (پنل دکتر)
//
// بیماران می‌تونن سوال‌شون رو آنلاین بپرسن و دکتر جواب بده
// این صفحه برای دکتره:
//
// - سمت چپ: لیست سوال‌های بیماران (با فیلتر وضعیت)
// - سمت راست: جزئیات سوال انتخاب شده + فرم پاسخ دکتر
//
// وضعیت‌ها: در انتظار پاسخ / در حال بررسی / پاسخ داده شد / لغو
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { consultationApi } from "@/lib/api/axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { MessageSquare, AlertTriangle, CheckCircle, Clock, ChevronRight } from "lucide-react";

// ─── نقشه وضعیت‌ها ────────────────────────────────────────────
// هر وضعیت: متن فارسی، متن انگلیسی، رنگ badge، آیکون
const STATUS_MAP: Record<string, { fa: string; en: string; badge: string; icon: React.ReactNode }> = {
  Waiting:    { fa: "در انتظار پاسخ", en: "Waiting",     badge: "badge-yellow", icon: <Clock className="w-3.5 h-3.5" /> },
  InProgress: { fa: "در حال بررسی",   en: "In Progress", badge: "badge-blue",   icon: <MessageSquare className="w-3.5 h-3.5" /> },
  Completed:  { fa: "پاسخ داده شد",   en: "Completed",   badge: "badge-green",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  Cancelled:  { fa: "لغو شده",        en: "Cancelled",   badge: "badge-red",    icon: <Clock className="w-3.5 h-3.5" /> },
};

export default function ConsultationsAdminPage() {
  const { lang } = useAppStore();
  const t = useTranslations(lang);
  const router = useRouter();

  // State ها
  const [consultations, setConsultations] = useState<any[]>([]); // لیست مشاوره‌ها
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Waiting");    // فیلتر فعلی (پیش‌فرض: در انتظار)
  const [selected, setSelected] = useState<any>(null); // مشاوره انتخاب شده برای پاسخ
  const [answer, setAnswer] = useState("");             // متن پاسخ دکتر
  const [answering, setAnswering] = useState(false);    // آیا داریم ارسال می‌کنیم؟

  // ─── بارگذاری مشاوره‌ها از سرور ─────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const res = await consultationApi.getAll({ status: filter });
      setConsultations(res.data?.items || []);
    } catch {
      setConsultations([]);
      toast.error(lang === "fa" ? "دریافت مشاوره‌ها ناموفق بود" : "Could not load consultations");
    } finally {
      setLoading(false);
    }
  };

  // وقتی فیلتر عوض میشه، دوباره بارگذاری کن و پنل جزئیات رو ببند
  // (وگرنه ممکنه یه مشاوره از فیلتر قبلی که دیگه توی لیست نیست، انتخاب‌شده بمونه)
  useEffect(() => { setSelected(null); load(); }, [filter]);

  // ─── تابع ارسال پاسخ دکتر ────────────────────────────────────
  const submitAnswer = async () => {
    if (!selected || !answer.trim()) return; // اگه جواب خالی بود، کاری نکن
    setAnswering(true);
    try {
      await consultationApi.answer(selected.id, { answer }); // به سرور بفرست
      toast.success(lang === "fa" ? "پاسخ ارسال شد" : "Answer submitted");
      setSelected(null);  // پنجره جزئیات رو ببند
      setAnswer("");       // فیلد پاسخ رو پاک کن
      load();              // لیست رو رفرش کن
    } catch {
      toast.error(lang === "fa" ? "خطا در ارسال" : "Submit failed");
    } finally {
      setAnswering(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان صفحه ─────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.nav.consultations}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lang === "fa" ? "مدیریت درخواست‌های مشاوره آنلاین" : "Manage online consultation requests"}
          </p>
        </div>

        {/* ─── تب‌های فیلتر وضعیت ─────────────────────────────── */}
        {/* هر دکمه یه وضعیت: کلیک → فیلتر → بارگذاری جدید */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === k
                  ? "bg-blue-600 text-white shadow-md"       // فعال: آبی
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50" // غیرفعال: سفید
              }`}>
              {v.icon}
              {lang === "fa" ? v.fa : v.en}
            </button>
          ))}
        </div>

        {/* ─── محتوای اصلی: لیست (چپ) + جزئیات (راست) ───────── */}
        {/* lg:col-span-2 برای لیست و lg:col-span-3 برای جزئیات */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ─── لیست مشاوره‌ها ──────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              // لودینگ: کارت‌های خاکستری
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card animate-pulse h-24 bg-gray-100" />
              ))
            ) : consultations.length === 0 ? (
              // هیچ مشاوره‌ای نیست
              <div className="card text-center py-10 text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                {t.common.noData}
              </div>
            ) : consultations.map(c => (
              // کارت هر مشاوره
              <div key={c.id}
                onClick={() => setSelected(c)} // کلیک = انتخاب برای نمایش جزئیات
                className={`card cursor-pointer hover:shadow-md transition-all ${
                  selected?.id === c.id ? "ring-2 ring-blue-500" : "" // اگه انتخاب شده: دور آبی
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {/* آواتار: حرف اول نام بیمار */}
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                      {c.patientName?.[0] || "؟"}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{c.patientName}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(c.requestedAt).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* badge "فوری" برای مشاوره‌های اورژانسی */}
                    {c.isUrgent && (
                      <span className="badge badge-red text-[10px]">
                        <AlertTriangle className="w-3 h-3 inline me-0.5" />
                        {lang === "fa" ? "فوری" : "Urgent"}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
                {/* خلاصه سوال بیمار - حداکثر ۲ خط */}
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{c.patientQuestion}</p>
              </div>
            ))}
          </div>

          {/* ─── جزئیات و فرم پاسخ ───────────────────────────── */}
          <div className="lg:col-span-3">
            {!selected ? (
              // هنوز چیزی انتخاب نشده
              <div className="card h-full flex flex-col items-center justify-center py-20 text-gray-300">
                <MessageSquare className="w-16 h-16 mb-3" />
                <p className="text-sm">{lang === "fa" ? "یک مورد را انتخاب کنید" : "Select a consultation"}</p>
              </div>
            ) : (
              <div className="card space-y-5">

                {/* ردیف بالا: نام بیمار + تاریخ + وضعیت */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selected.patientName}</h3>
                    <p className="text-xs text-gray-400">
                      {new Date(selected.requestedAt).toLocaleString(lang === "fa" ? "fa-IR" : "en")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.isUrgent && (
                      <span className="badge badge-red flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {lang === "fa" ? "فوری" : "Urgent"}
                      </span>
                    )}
                    <span className={`badge ${STATUS_MAP[selected.status]?.badge}`}>
                      {lang === "fa" ? STATUS_MAP[selected.status]?.fa : STATUS_MAP[selected.status]?.en}
                    </span>
                  </div>
                </div>

                {/* سوال بیمار - با پس‌زمینه خاکستری */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                    {t.consultation.question}
                  </label>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                    {selected.patientQuestion}
                  </div>
                </div>

                {/* اگه قبلاً پاسخ داده شده، نشون بده */}
                {selected.doctorAnswer && (
                  <div>
                    <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide block mb-2">
                      {t.consultation.answer}
                    </label>
                    {/* پاسخ دکتر با پس‌زمینه آبی کمرنگ */}
                    <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 leading-relaxed border border-blue-100">
                      {selected.doctorAnswer}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {selected.answeredAt && new Date(selected.answeredAt).toLocaleString(lang === "fa" ? "fa-IR" : "en")}
                    </p>
                  </div>
                )}

                {/* فرم پاسخ - فقط اگه هنوز پاسخ نداده */}
                {(selected.status === "Waiting" || selected.status === "InProgress") && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                      {lang === "fa" ? "پاسخ پزشک" : "Doctor Answer"}
                    </label>
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={4}
                      className="input-field resize-none text-sm"
                      placeholder={lang === "fa" ? "پاسخ خود را وارد کنید..." : "Enter your answer..."}
                    />
                    <div className="flex gap-2 mt-3">
                      {/* دکمه ارسال - اگه خالی بود یا در حال ارسال: غیرفعال */}
                      <button
                        onClick={submitAnswer}
                        disabled={!answer.trim() || answering}
                        className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                        {/* اسپینر هنگام ارسال */}
                        {answering && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {lang === "fa" ? "ارسال پاسخ" : "Submit Answer"}
                      </button>
                      {/* دکمه چت - برای مکالمه بیشتر */}
                      <button
                        onClick={() => router.push(`/portal/consultation/${selected.id}`)}
                        className="btn-secondary flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        {lang === "fa" ? "چت" : "Chat"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
