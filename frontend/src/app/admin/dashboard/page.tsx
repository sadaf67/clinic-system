// ══════════════════════════════════════════════════════════════
// صفحه داشبورد (خلاصه وضعیت کلینیک)
//
// این صفحه مثل "صفحه اول روزنامه" کلینیکه:
// - ۶ کارت آماری: تعداد بیماران، نوبت‌های امروز، موارد در انتظار و...
// - نمودار میله‌ای: نوبت‌های هفته جاری (چه روزایی چقدر شلوغ بود)
// - نمودار خطی: بیماران جدید ماه‌های اخیر
// - جدول: نوبت‌های امروز (چه کسایی قراره امروز بیان)
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { dashboardApi } from "@/lib/api/axios";
import AdminLayout from "@/components/layout/AdminLayout";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from "recharts"; // کتابخونه رسم نمودار
import {
  Users, Calendar, Clock, MessageSquare,
  UserPlus, CheckCircle, AlertCircle, Sparkles
} from "lucide-react"; // آیکون‌ها

// ─── شکل داده‌های آماری که از سرور می‌گیریم ─────────────────
interface DashboardStats {
  totalPatients: number;          // کل بیماران ثبت‌شده
  todayAppointments: number;      // نوبت‌های امروز
  pendingAppointments: number;    // نوبت‌های در انتظار تأیید
  pendingConsultations: number;   // مشاوره‌های پاسخ‌نداده
  newPatientsThisMonth: number;   // بیماران جدید این ماه
  completedVisitsThisMonth: number; // ویزیت‌های انجام شده این ماه

  // داده‌های نمودار هفتگی: هر روز چند نوبت بود
  weeklyAppointments: Array<{
    day: string;       // نام روز فارسی (مثلاً "شنبه")
    dayEn: string;     // نام روز انگلیسی (مثلاً "Sat")
    count: number;     // کل نوبت‌ها
    completed: number; // نوبت‌های انجام شده
    cancelled: number; // نوبت‌های لغو شده
  }>;

  // داده‌های نمودار ماهانه: هر ماه چند بیمار جدید
  monthlyNewPatients: Array<{
    month: string;   // نام ماه فارسی
    monthEn: string; // نام ماه انگلیسی
    count: number;   // تعداد بیمار جدید
  }>;

  // نوبت‌های امروز برای جدول پایین صفحه
  upcomingToday: Array<{
    id: string;
    patientName: string;    // نام بیمار
    startTime: string;      // ساعت شروع (مثلاً "09:30:00")
    type: string;           // نوع: Online یا InPerson
    status: string;         // وضعیت: confirmed, pending و...
    chiefComplaint: string; // شکایت اصلی (چرا اومده)
  }>;
}

export default function DashboardPage() {
  const { lang } = useAppStore(); // زبان فعلی
  const t = useTranslations(lang); // متن‌های ترجمه شده
  const router = useRouter(); // برای رفتن به صفحه مدیریت نوبت‌ها با کلیک روی ردیف

  // State ها: داده‌های آماری و وضعیت بارگذاری
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true); // اول true هست تا داده‌ها بیان

  // ─── بارگذاری داده‌ها از سرور هنگام باز شدن صفحه ──────────
  useEffect(() => {
    dashboardApi.getStats()
      .then(res => setStats(res.data))      // اگه موفق: داده‌ها رو ذخیره کن
      .catch(() => {
        setStats(null);
        toast.error(lang === "fa" ? "دریافت آمار داشبورد ناموفق بود" : "Could not load dashboard statistics");
      })
      .finally(() => setLoading(false));     // در هر صورت: لودینگ رو خاموش کن
  }, [lang]);

  // ─── ساخت کارت‌های آماری بالای صفحه ──────────────────────
  // ۶ کارت: هر کدوم یه آیکون، یه متن، یه عدد، یه رنگ
  const statCards = stats ? [
    { icon: <Users className="w-6 h-6" />, label: t.dashboard.totalPatients, value: stats.totalPatients, color: "blue" },
    { icon: <Calendar className="w-6 h-6" />, label: t.dashboard.todayAppointments, value: stats.todayAppointments, color: "indigo" },
    { icon: <Clock className="w-6 h-6" />, label: t.dashboard.pendingAppointments, value: stats.pendingAppointments, color: "amber" },
    { icon: <MessageSquare className="w-6 h-6" />, label: t.dashboard.pendingConsultations, value: stats.pendingConsultations, color: "purple" },
    { icon: <UserPlus className="w-6 h-6" />, label: t.dashboard.newPatientsMonth, value: stats.newPatientsThisMonth, color: "green" },
    { icon: <CheckCircle className="w-6 h-6" />, label: t.dashboard.completedVisitsMonth, value: stats.completedVisitsThisMonth, color: "teal" },
  ] : [];

  // نقشه رنگ‌ها: هر رنگ یه کلاس CSS مخصوص داره
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    teal: "bg-teal-50 text-teal-600",
  };

  // ─── تابع نشون دادن وضعیت نوبت با رنگ مناسب ──────────────
  // هر وضعیت یه "badge" رنگی داره (مثل برچسب)
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: "badge-green",   // تأیید شده → سبز
      pending: "badge-yellow",    // در انتظار → زرد
      cancelled: "badge-red",     // لغو شده → قرمز
      completed: "badge-blue",    // انجام شده → آبی
    };
    // متن badge: فارسی یا انگلیسی
    const labelMap: Record<string, string> = lang === "fa"
      ? { confirmed: "تأیید شده", pending: "در انتظار", cancelled: "لغو", completed: "انجام شده" }
      : { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled", completed: "Completed" };

    return <span className={map[status.toLowerCase()] || "badge-gray"}>{labelMap[status.toLowerCase()] || status}</span>;
  };

  // ─── نمایش اسکلت در حین دریافت داده‌ها ───────────────────
  // به جای یه دایره چرخنده، شکل نهایی صفحه رو خاکستری نشون میدیم
  // اینطوری چیدمان نمی‌پره و حس سریع‌تر بودن میده
  if (loading) return (
    <AdminLayout>
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="h-72 bg-gray-100 rounded-2xl" />
          <div className="h-72 bg-gray-100 rounded-2xl" />
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    </AdminLayout>
  );

  // ─── اگه سرور جواب نداد ──────────────────────────────────
  // بدون این حالت، صفحه کاملاً خالی نشون داده می‌شد
  if (!stats) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <p className="text-gray-900 font-semibold">
          {lang === "fa" ? "دریافت آمار داشبورد ناموفق بود" : "Could not load dashboard statistics"}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          {lang === "fa" ? "ارتباط با سرور برقرار نشد" : "Could not reach the server"}
        </p>
        <button onClick={() => window.location.reload()} className="btn-secondary mt-5">
          {lang === "fa" ? "تلاش دوباره" : "Try again"}
        </button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان صفحه ─────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {lang === "fa" ? "خلاصه وضعیت کلینیک شما" : "Your clinic overview"}
          </p>
        </div>

        {/* ─── ویجت «امروز در یک نگاه» ──────────────────────────── */}
        {/* چرا لازم بود؟ ۶ کارت پایین‌تر همه‌ی آمار رو یه‌جا نشون می‌دن، ولی */}
        {/* وقتی پزشک صبح وارد سیستم میشه، اولین سؤالش «امروز چه خبره» ست — */}
        {/* این ویجت همون سه عدد حیاتی رو برجسته و اول از همه نشون میده */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 sm:p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 text-blue-100">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric"
                })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {/* نوبت‌های امروز */}
            <button onClick={() => router.push("/admin/appointments")}
              className="flex items-center justify-between gap-3 bg-white/10 hover:bg-white/15 backdrop-blur rounded-xl p-4 transition text-start">
              <div>
                <div className="text-2xl font-bold">{stats.todayAppointments.toLocaleString(lang === "fa" ? "fa-IR" : "en")}</div>
                <div className="text-xs text-blue-100 mt-0.5">{lang === "fa" ? "نوبت امروز" : "Today's Appointments"}</div>
              </div>
              <Calendar className="w-6 h-6 text-blue-200 flex-shrink-0" />
            </button>

            {/* در انتظار تأیید */}
            <button onClick={() => router.push("/admin/appointments")}
              className="flex items-center justify-between gap-3 bg-white/10 hover:bg-white/15 backdrop-blur rounded-xl p-4 transition text-start">
              <div>
                <div className="text-2xl font-bold">{stats.pendingAppointments.toLocaleString(lang === "fa" ? "fa-IR" : "en")}</div>
                <div className="text-xs text-blue-100 mt-0.5">{lang === "fa" ? "در انتظار تأیید" : "Awaiting Confirmation"}</div>
              </div>
              <Clock className="w-6 h-6 text-blue-200 flex-shrink-0" />
            </button>

            {/* مشاوره‌های در انتظار پاسخ */}
            <button onClick={() => router.push("/admin/consultations")}
              className="flex items-center justify-between gap-3 bg-white/10 hover:bg-white/15 backdrop-blur rounded-xl p-4 transition text-start">
              <div>
                <div className="text-2xl font-bold">{stats.pendingConsultations.toLocaleString(lang === "fa" ? "fa-IR" : "en")}</div>
                <div className="text-xs text-blue-100 mt-0.5">{lang === "fa" ? "مشاوره در انتظار پاسخ" : "Consultations Awaiting Reply"}</div>
              </div>
              <MessageSquare className="w-6 h-6 text-blue-200 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* ─── کارت‌های آماری ──────────────────────────────────── */}
        {/* grid = ۲ ستون روی موبایل، ۳ روی تبلت، ۶ روی دسکتاپ */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card, i) => (
            <div key={i} className="stat-card">
              {/* آیکون با رنگ پس‌زمینه */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[card.color]}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                {/* عدد بزرگ: اگه فارسی باشه با ارقام فارسی (۱۲۳) وگرنه لاتین */}
                <div className="text-2xl font-bold text-gray-900">{card.value.toLocaleString(lang === "fa" ? "fa-IR" : "en")}</div>
                <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ردیف نمودارها ───────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* نمودار میله‌ای: نوبت‌های هفته */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{t.dashboard.weeklyChart}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.weeklyAppointments.map(d => ({
                ...d,
                // بسته به زبان، نام روز فارسی یا انگلیسی نشون بده
                name: lang === "fa" ? d.day : d.dayEn
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "var(--font-vazir)" }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontFamily: "var(--font-vazir)", borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                {/* سه میله: کل، انجام شده، لغو */}
                <Bar dataKey="count" name={lang === "fa" ? "کل" : "Total"} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name={lang === "fa" ? "انجام شده" : "Completed"} fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cancelled" name={lang === "fa" ? "لغو شده" : "Cancelled"} fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* نمودار ناحیه‌ای: بیماران جدید ماهانه */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">{t.dashboard.monthlyChart}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats?.monthlyNewPatients.map(d => ({
                ...d,
                name: lang === "fa" ? d.month : d.monthEn
              }))}>
                {/* gradient = سایه رنگی زیر خط */}
                <defs>
                  <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "var(--font-vazir)" }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontFamily: "var(--font-vazir)", borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2}
                  fill="url(#colorPatients)" name={lang === "fa" ? "بیمار جدید" : "New Patients"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── جدول نوبت‌های امروز ─────────────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">{t.dashboard.upcomingToday}</h3>

          {/* اگه نوبتی نبود، یه پیام نشون بده */}
          {stats?.upcomingToday.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {lang === "fa" ? "نوبتی برای امروز ثبت نشده" : "No appointments for today"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* جدول نوبت‌ها */}
              <table className="w-full data-table">
                <thead>
                  {/* ستون‌ها: نام بیمار، ساعت، نوع ویزیت، شکایت، وضعیت */}
                  <tr>
                    <th className="text-start">{t.common.name}</th>
                    <th className="text-start">{t.common.time}</th>
                    <th className="text-start">{t.appointment.type}</th>
                    <th className="text-start">{t.appointment.chiefComplaint}</th>
                    <th className="text-start">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.upcomingToday.map(appt => (
                    // با کلیک روی ردیف، به صفحه مدیریت نوبت‌ها می‌ره
                    <tr key={appt.id} onClick={() => router.push("/admin/appointments")}
                      className="cursor-pointer hover:bg-blue-50/30 transition-colors">
                      <td className="font-medium text-gray-900">{appt.patientName}</td>
                      {/* ساعت همیشه ltr (چپ‌به‌راست) باشه: 09:30 */}
                      <td className="text-gray-600 tabular-nums" dir="ltr">
                        {appt.startTime.toString().slice(0, 5)} {/* فقط ساعت و دقیقه */}
                      </td>
                      <td>
                        {/* badge آبی برای آنلاین، خاکستری برای حضوری */}
                        <span className={`badge ${appt.type === "Online" ? "badge-blue" : "badge-gray"}`}>
                          {appt.type === "Online"
                            ? (lang === "fa" ? "آنلاین" : "Online")
                            : (lang === "fa" ? "حضوری" : "In-Person")}
                        </span>
                      </td>
                      {/* شکایت: حداکثر ۲۰۰px عرض، اگه بیشتر شد ... بزاره */}
                      <td className="text-gray-500 text-xs max-w-[200px] truncate">{appt.chiefComplaint || "—"}</td>
                      <td>{statusBadge(appt.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
