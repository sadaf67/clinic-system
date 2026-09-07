"use client";

// ══════════════════════════════════════════════════════════════
// پنل بیمار (Patient Portal Page)
//
// این صفحه "خانه" بیمار توی سیستمه — چیزی مثل داشبورد شخصی.
// بیمار اینجا می‌تونه:
// - خلاصه وضعیت سلامتش رو ببینه
// - علائم حیاتی (فشار، وزن، قند خون و...) رو به صورت نمودار ببینه
// - نوبت‌هاش رو ببینه
// - سوابق پزشکی، نسخه‌ها و مشاوره‌هاش رو بررسی کنه
//
// آدرس: /portal
// فقط کاربرانی که role = "Patient" دارن می‌تونن اینجا بیان
// ══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { useAuthHydrated } from "@/lib/hooks/useHydrated";
import { patientApi, appointmentApi, consultationApi, medicalRecordApi, prescriptionApi } from "@/lib/api/axios";
import BookAppointmentModal from "@/components/forms/BookAppointmentModal";

// کتابخونه نمودار — خط، محور، راهنما
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// آیکون‌ها
import {
  Calendar, FileText, Pill, MessageSquare, Activity,
  TrendingUp, TrendingDown, Minus, Bell, LogOut,
  Globe, ChevronRight, Stethoscope, User
} from "lucide-react";

import toast from "react-hot-toast";

// ──────────────────────────────────────────────────────────────
// VitalTrend: ساختار داده برای روند یه علامت حیاتی
// type = نوع (1=وزن، 2=فشار سیستولیک و...)
// label = نام فارسی/انگلیسی
// unit = واحد اندازه‌گیری (kg, mmHg و...)
// dataPoints = آرایه‌ای از {date, value} برای رسم نمودار
// min/max/average = کمترین، بیشترین، میانگین
// trendDirection = روند: "up" صعودی، "down" نزولی، "stable" ثابت
// ──────────────────────────────────────────────────────────────
interface VitalTrend {
  type: number;
  label: string;
  unit: string;
  dataPoints: Array<{ date: string; value: number }>;
  min: number;
  max: number;
  average: number;
  trendDirection: "up" | "down" | "stable";
}

// ── رنگ خط نمودار برای هر نوع علامت حیاتی ──────────────────
// هر عدد = نوع علامت → یه رنگ مخصوص
const VITAL_COLORS: Record<number, string> = {
  1: "#3b82f6", // وزن — آبی
  2: "#ef4444", // فشار سیستولیک — قرمز
  3: "#f97316", // فشار دیاستولیک — نارنجی
  4: "#8b5cf6", // قند خون — بنفش
  5: "#ec4899", // ضربان قلب — صورتی
  6: "#f59e0b", // دما — زرد
  7: "#06b6d4", // اشباع اکسیژن — آبی روشن
  8: "#10b981", // BMI — سبز
};

// ── محدوده نرمال هر علامت حیاتی ────────────────────────────
// در نمودار، دو خط افقی سبز (حد بالا و پایین نرمال) کشیده میشه
// null یعنی "نرمال" برای این علامت تعریف نشده (مثل وزن یا BMI)
// ── برچسب فارسی وضعیت‌ها ───────────────────────────────────
// اسم وضعیت‌ها از سرور انگلیسی میاد؛ در حالت فارسی ترجمه‌شون می‌کنیم
const CONSULTATION_STATUS_FA: Record<string, string> = {
  Waiting:    "در انتظار پاسخ",
  InProgress: "در حال بررسی",
  Completed:  "پاسخ داده شد",
  Cancelled:  "لغو شده",
};

const PRESCRIPTION_STATUS_FA: Record<string, string> = {
  Active:    "فعال",
  Expired:   "منقضی",
  Cancelled: "لغو شده",
};

const VITAL_NORMAL_RANGE: Record<number, { min: number; max: number } | null> = {
  2: { min: 90,   max: 120  },  // فشار سیستولیک: 90-120 mmHg
  3: { min: 60,   max: 80   },  // فشار دیاستولیک: 60-80 mmHg
  4: { min: 70,   max: 140  },  // قند خون: 70-140 mg/dL
  5: { min: 60,   max: 100  },  // ضربان قلب: 60-100 bpm
  6: { min: 36.1, max: 37.2 },  // دما: 36.1-37.2 سانتیگراد
  7: { min: 95,   max: 100  },  // اشباع اکسیژن: 95-100%
  1: null,                       // وزن: بستگی به قد داره، نرمال واحد نداره
  8: null,                       // BMI: نرمال با توجه به شخص فرق داره
};

// ──────────────────────────────────────────────────────────────
// PatientPortalPage: کامپوننت اصلی پنل بیمار
// ──────────────────────────────────────────────────────────────
export default function PatientPortalPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { lang, setLang } = useAppStore();
  const t = useTranslations(lang); // دیکشنری ترجمه

  // آیا اطلاعات لاگین از localStorage خونده شده؟
  const hydrated = useAuthHydrated();

  // تب فعال — کدوم بخش رو الان نشون بده؟
  const [activeTab, setActiveTab] = useState<"overview" | "appointments" | "records" | "prescriptions" | "consultations" | "vitals">("overview");

  // داده‌های اصلی صفحه
  const [vitalTrends, setVitalTrends]   = useState<VitalTrend[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patientData,  setPatientData]  = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);

  // ── اعتبارسنجی دسترسی ───────────────────────────────────
  // اگه لاگین نکرده یا دکتر هست (نه بیمار)، برگرده به لاگین
  //
  // شرط hydrated لازمه: اطلاعات لاگین از localStorage خونده میشه
  // و این کار یه لحظه بعد از اولین رندر انجام میشه. بدون این شرط،
  // بیمارِ لاگین‌کرده با هر بار Refresh پرت می‌شد به صفحه ورود.
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || user?.role !== "Patient") {
      router.push("/login");
      return;
    }
    loadData();
  }, [hydrated, isAuthenticated, user?.role]);

  // ── بارگذاری موازی اطلاعات از API ────────────────────────
  // ابتدا پروفایل خوانده می‌شود تا شناسه پرونده برای علائم حیاتی در دسترس باشد.
  const loadData = async () => {
    try {
      const patRes = await patientApi.getMe();
      const [apptRes, vitalRes, recordRes, prescriptionRes, consultationRes] = await Promise.all([
        appointmentApi.getAll({}),
        patientApi.getVitalTrends(patRes.data.id),
        medicalRecordApi.getByPatient(patRes.data.id),
        prescriptionApi.getByPatient(patRes.data.id),
        consultationApi.getAll({ pageSize: 100 }),
      ]);
      setPatientData(patRes.data);
      setAppointments(apptRes.data?.items || []);
      setVitalTrends(vitalRes.data || []);
      setMedicalRecords(recordRes.data || []);
      setPrescriptions(prescriptionRes.data || []);
      setConsultations(consultationRes.data?.items || []);
    } catch {
      setVitalTrends([]);
      setAppointments([]);
      setPatientData(null);
      setMedicalRecords([]);
      setPrescriptions([]);
      setConsultations([]);
      toast.error(lang === "fa" ? "دریافت اطلاعات پرتال ناموفق بود" : "Could not load portal data");
    } finally {
      setLoading(false); // بارگذاری تموم شد
    }
  };

  // ── محاسبه آمار کارت خوش‌آمدگویی از روی داده واقعی ──────
  // نوبت‌های پیشِ‌رو (تأییدشده یا در انتظار) — مرتب از نزدیک‌ترین
  const upcomingAppointments = appointments
    .filter((a: any) => {
      if (a.status !== "Confirmed" && a.status !== "Pending") return false;
      const when = new Date(`${String(a.appointmentDate).slice(0, 10)}T${(a.startTime || "00:00:00").slice(0, 8)}`);
      return when.getTime() >= Date.now();
    })
    .sort((a: any, b: any) =>
      `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`));

  const nextAppointment = upcomingAppointments[0];

  // مشاوره‌های باز = در انتظار پاسخ یا در حال بررسی
  const activeConsultations = consultations.filter(
    (c: any) => c.status === "Waiting" || c.status === "InProgress"
  ).length;

  // ── کامپوننت کوچیک آیکون روند ───────────────────────────
  // up = قرمز (بد)، down = آبی، stable = سبز (پایدار)
  const TrendIcon = ({ dir }: { dir: string }) => {
    if (dir === "up")   return <TrendingUp   className="w-4 h-4 text-red-500"   />;
    if (dir === "down") return <TrendingDown  className="w-4 h-4 text-blue-500"  />;
    return                     <Minus         className="w-4 h-4 text-green-500" />;
  };

  // ── تعریف تب‌های بالای صفحه ──────────────────────────────
  const tabs = [
    { id: "overview",       icon: <Activity       className="w-4 h-4" />, label: lang === "fa" ? "خلاصه"    : "Overview"         },
    { id: "appointments",   icon: <Calendar       className="w-4 h-4" />, label: t.nav.appointments                               },
    { id: "records",        icon: <FileText       className="w-4 h-4" />, label: t.nav.medicalRecords                             },
    { id: "prescriptions",  icon: <Pill           className="w-4 h-4" />, label: t.nav.prescriptions                              },
    { id: "consultations",  icon: <MessageSquare  className="w-4 h-4" />, label: t.nav.consultations                              },
    { id: "vitals",         icon: <Activity       className="w-4 h-4" />, label: t.patient.vitalSigns                             },
  ] as const;

  // ── صفحه بارگذاری ────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
    <div
      className={`min-h-screen bg-gray-50 ${lang === "fa" ? "rtl" : "ltr"}`}
      dir={lang === "fa" ? "rtl" : "ltr"}
    >

      {/* ════ هدر صفحه ════════════════════════════════════════
          شامل: لوگو + نام پنل، دکمه زبان، دکمه خروج
          sticky = همیشه بالای صفحه میمونه حتی موقع اسکرول
      ══════════════════════════════════════════════════════ */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* لوگو + نام */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{lang === "fa" ? "پنل بیمار" : "Patient Portal"}</div>
              {/* نام بیمار — فارسی یا انگلیسی */}
              <div className="text-xs text-gray-400">{lang === "fa" ? user?.fullName : user?.fullNameEn}</div>
            </div>
          </div>
          {/* دکمه‌های بالا راست */}
          <div className="flex items-center gap-2">
            {/* تغییر زبان */}
            <button
              onClick={() => setLang(lang === "fa" ? "en" : "fa")}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            >
              <Globe className="w-4 h-4" />
            </button>
            {/* خروج از حساب */}
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── تب‌های ناوبری ───────────────────────────────────
            overflow-x-auto = روی موبایل اسکرول افقی میشه
        ──────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"       // تب فعال: آبی
                  : "border-transparent text-gray-500 hover:text-gray-700" // غیرفعال: خاکستری
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ════ محتوای اصلی صفحه ════ */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ════ تب Overview — خلاصه وضعیت ═════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* ── کارت خوش‌آمدگویی با گرادیان آبی ─────────────
                نشون میده: نام بیمار، تعداد ویزیت، نوبت بعدی، مشاوره‌های فعال
            ──────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-4">
                {/* آواتار — اولین حرف اسم بیمار */}
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold backdrop-blur">
                  {(lang === "fa" ? user?.fullName : user?.fullNameEn)?.charAt(0) || "U"}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {lang === "fa"
                      ? `${t.auth.welcome}، ${user?.fullName}`
                      : `${t.auth.welcome}, ${user?.fullNameEn}`}
                  </h2>
                  <p className="text-blue-200 text-sm mt-1">
                    {lang === "fa" ? "وضعیت سلامت شما در یک نگاه" : "Your health status at a glance"}
                  </p>
                </div>
              </div>

              {/* ۳ آمار کوچیک توی کارت */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[
                  {
                    label: lang === "fa" ? "کل ویزیت" : "Total Visits",
                    value: patientData?.totalVisits ?? 0,
                  },
                  {
                    label: lang === "fa" ? "نوبت بعدی" : "Next Appt.",
                    // تاریخ واقعی نزدیک‌ترین نوبت، نه یه تیک بی‌معنی
                    value: nextAppointment
                      ? new Date(nextAppointment.appointmentDate).toLocaleDateString(
                          lang === "fa" ? "fa-IR" : "en-US", { month: "short", day: "numeric" })
                      : "—",
                    small: true,
                  },
                  {
                    label: lang === "fa" ? "مشاوره فعال" : "Active Consult.",
                    value: activeConsultations,
                  },
                ].map(item => (
                  <div key={item.label} className="bg-white/10 rounded-xl p-3 backdrop-blur text-center">
                    <div className={`${item.small ? "text-base sm:text-lg" : "text-2xl"} font-bold leading-8`}>{item.value}</div>
                    <div className="text-blue-200 text-xs mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ۴ کارت علائم حیاتی آخر ──────────────────────
                فقط ۴ تا اول از vitalTrends نشون داده میشه
            ──────────────────────────────────────────────────── */}
            {vitalTrends.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  {lang === "fa" ? "آخرین علائم حیاتی" : "Latest Vital Signs"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {vitalTrends.slice(0, 4).map(v => (
                    <div key={v.type} className="card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{v.label}</span>
                        <TrendIcon dir={v.trendDirection} /> {/* آیکون روند */}
                      </div>
                      {/* آخرین مقدار ثبت شده */}
                      <div className="text-xl font-bold text-gray-900">
                        {v.dataPoints[v.dataPoints.length - 1]?.value}
                        <span className="text-sm text-gray-400 font-normal ms-1">{v.unit}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {lang === "fa" ? `میانگین: ${v.average}` : `Avg: ${v.average}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── نوبت‌های پیشِ‌رو ────────────────────────────
                فقط نوبت‌های تأییدشده/در انتظارِ تاریخ‌گذشته‌نشده
            ──────────────────────────────────────────────────── */}
            {upcomingAppointments.slice(0, 2).map((appt: any) => (
              <div key={appt.id} className="card border-s-4 border-blue-500 flex items-center gap-4">
                <Calendar className="w-10 h-10 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {lang === "fa" ? "نوبت آینده" : "Upcoming Appointment"}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {/* تاریخ — فارسی یا میلادی */}
                    {new Date(appt.appointmentDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US")}
                    {" — "}
                    {appt.startTime?.slice(0, 5)} {/* فقط ساعت و دقیقه */}
                  </div>
                </div>
                {/* نوع نوبت (آنلاین/حضوری) */}
                <span className={`badge ${appt.type === "Online" ? "badge-blue" : "badge-gray"}`}>
                  {appt.type === "Online"
                    ? (lang === "fa" ? "آنلاین" : "Online")
                    : (lang === "fa" ? "حضوری" : "In-Person")}
                </span>
                {/* اگه لینک ویزیت آنلاین داره، دکمه ورود نشون بده */}
                {appt.meetingLink && (
                  <a href={appt.meetingLink} target="_blank" rel="noopener"
                    className="btn-primary text-xs py-1.5 px-3">
                    {lang === "fa" ? "ورود به جلسه" : "Join"}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════ تب Vitals — نمودار علائم حیاتی ═══════════════ */}
        {activeTab === "vitals" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t.patient.progress}</h2>
              <p className="text-sm text-gray-400">
                {lang === "fa" ? "روند تغییرات علائم حیاتی شما" : "Your vital sign trends over time"}
              </p>
            </div>

            {/* اگه داده‌ای نیست */}
            {vitalTrends.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "هنوز داده‌ای ثبت نشده" : "No vital signs recorded yet"}
              </div>
            ) : (
              /* برای هر علامت حیاتی یه کارت با نمودار خطی */
              vitalTrends.map(vital => {
                const normalRange = VITAL_NORMAL_RANGE[vital.type]; // محدوده نرمال
                const lastValue = vital.dataPoints[vital.dataPoints.length - 1]?.value; // آخرین مقدار

                // آیا آخرین مقدار توی محدوده نرمال هست؟
                const isNormal = normalRange
                  ? lastValue >= normalRange.min && lastValue <= normalRange.max
                  : null; // اگه نرمال تعریف نشده، null

                return (
                  <div key={vital.type} className="card">
                    {/* سربرگ کارت — نام، آخرین مقدار، روند */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* آیکون رنگی */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${VITAL_COLORS[vital.type]}20` }}>
                          <Activity style={{ color: VITAL_COLORS[vital.type] }} className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{vital.label}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {lang === "fa" ? "آخرین مقدار:" : "Latest:"}{" "}
                              <strong className="text-gray-700">{lastValue} {vital.unit}</strong>
                            </span>
                            {/* badge نرمال/غیرنرمال */}
                            {isNormal !== null && (
                              <span className={`badge text-[10px] ${isNormal ? "badge-green" : "badge-red"}`}>
                                {isNormal
                                  ? (lang === "fa" ? "نرمال" : "Normal")
                                  : (lang === "fa" ? "خارج از محدوده" : "Out of range")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* آمار: کمینه، میانگین، بیشینه + روند */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-gray-400 text-xs">{lang === "fa" ? "کمینه" : "Min"}</div>
                          <div className="font-semibold">{vital.min}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 text-xs">{lang === "fa" ? "میانگین" : "Avg"}</div>
                          <div className="font-semibold">{vital.average}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 text-xs">{lang === "fa" ? "بیشینه" : "Max"}</div>
                          <div className="font-semibold">{vital.max}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <TrendIcon dir={vital.trendDirection} />
                          <span className="text-gray-500">{t.patient.trends[vital.trendDirection]}</span>
                        </div>
                      </div>
                    </div>

                    {/* ── نمودار خطی ──────────────────────────────
                        ResponsiveContainer = پر کردن عرض کارت
                        LineChart = نمودار خطی با نقاط داده
                        ReferenceLine = خطوط افقی سبز (حد نرمال)
                    ──────────────────────────────────────────────── */}
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={vital.dataPoints.map(d => ({
                        ...d,
                        // تاریخ رو به فرمت خوانا تبدیل می‌کنه (مثلاً "فروردین ۵")
                        date: new Date(d.date).toLocaleDateString(
                          lang === "fa" ? "fa-IR" : "en-US",
                          { month: "short", day: "numeric" }
                        )
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: "var(--font-vazir)" }} />
                        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ fontFamily: "var(--font-vazir)", borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                          formatter={(v: number) => [`${v} ${vital.unit}`, vital.label]}
                        />

                        {/* خطوط افقی محدوده نرمال — فقط اگه نرمال تعریف شده */}
                        {normalRange && (
                          <>
                            <ReferenceLine
                              y={normalRange.max} stroke="#22c55e" strokeDasharray="4 4"
                              label={{ value: lang === "fa" ? "حد بالا" : "Max Normal", fill: "#22c55e", fontSize: 10 }}
                            />
                            <ReferenceLine
                              y={normalRange.min} stroke="#22c55e" strokeDasharray="4 4"
                              label={{ value: lang === "fa" ? "حد پایین" : "Min Normal", fill: "#22c55e", fontSize: 10 }}
                            />
                          </>
                        )}

                        {/* خط اصلی نمودار */}
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={VITAL_COLORS[vital.type]}
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: VITAL_COLORS[vital.type] }}
                          activeDot={{ r: 6 }}
                          name={vital.label}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "records" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{t.nav.medicalRecords}</h2>
            {medicalRecords.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "سابقه پزشکی ثبت نشده است" : "No medical records found"}
              </div>
            ) : medicalRecords.map(record => (
              <div key={record.id} className="card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{record.diagnosis || (lang === "fa" ? "بدون تشخیص" : "No diagnosis")}</div>
                    <div className="text-sm text-gray-500 mt-1">{record.chiefComplaint || "—"}</div>
                  </div>
                  <time className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(record.visitDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "prescriptions" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{t.nav.prescriptions}</h2>
            {prescriptions.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "نسخه‌ای ثبت نشده است" : "No prescriptions found"}
              </div>
            ) : prescriptions.map(prescription => (
              <div key={prescription.id} className="card flex items-center gap-4">
                <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <Pill className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-mono text-sm text-gray-900">{prescription.prescriptionCode}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(prescription.issuedDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                  </div>
                </div>
                <span className={`badge ${prescription.isExpired || prescription.status === "Cancelled" ? "badge-red" : "badge-green"}`}>
                  {prescription.isExpired
                    ? (lang === "fa" ? "منقضی" : "Expired")
                    : (lang === "fa" ? (PRESCRIPTION_STATUS_FA[prescription.status] ?? prescription.status) : prescription.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "consultations" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{t.nav.consultations}</h2>
            {consultations.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "مشاوره‌ای ثبت نشده است" : "No consultations found"}
              </div>
            ) : consultations.map(consultation => (
              <button
                key={consultation.id}
                onClick={() => router.push(`/portal/consultation/${consultation.id}`)}
                className="card w-full text-start hover:border-blue-200 transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{consultation.patientQuestion || "—"}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(consultation.requestedAt).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    </div>
                  </div>
                  <span className={`badge ${
                    consultation.status === "Completed" ? "badge-green" :
                    consultation.status === "Cancelled" ? "badge-red" :
                    consultation.status === "InProgress" ? "badge-blue" : "badge-yellow"
                  }`}>
                    {lang === "fa" ? (CONSULTATION_STATUS_FA[consultation.status] ?? consultation.status) : consultation.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ════ تب Appointments — لیست نوبت‌ها ══════════════════ */}
        {activeTab === "appointments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t.nav.appointments}</h2>
              <button
                onClick={() => setShowBookModal(true)}
                className="btn-primary text-sm"
              >
                {t.appointment.bookAppointment}
              </button>
            </div>

            {/* اگه نوبتی نیست */}
            {appointments.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "نوبتی یافت نشد" : "No appointments found"}
              </div>
            ) : (
              appointments.map((appt: any) => (
                <div key={appt.id} className="card flex items-center gap-4">
                  {/* آیکون نوع نوبت */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    appt.type === "Online" ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* تاریخ و ساعت */}
                    <div className="font-medium text-gray-900">
                      {new Date(appt.appointmentDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US")}
                      {" — "}
                      {appt.startTime?.slice(0, 5)}
                    </div>
                    {/* شکایت اصلی */}
                    <div className="text-sm text-gray-500 truncate mt-0.5">
                      {appt.chiefComplaint || (lang === "fa" ? "بدون شکایت ثبت شده" : "No chief complaint")}
                    </div>
                  </div>

                  {/* badgeهای نوع و وضعیت */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${appt.type === "Online" ? "badge-blue" : "badge-gray"}`}>
                      {appt.type === "Online"
                        ? (lang === "fa" ? "آنلاین" : "Online")
                        : (lang === "fa" ? "حضوری" : "In-Person")}
                    </span>
                    <span className={`badge ${
                      appt.status === "Confirmed" ? "badge-green" :
                      appt.status === "Cancelled" ? "badge-red"   :
                      appt.status === "Completed" ? "badge-blue"  : "badge-yellow"
                    }`}>
                      {lang === "fa"
                        ? ({ Confirmed: "تأیید", Pending: "در انتظار", Cancelled: "لغو", Completed: "انجام شده", NoShow: "غایب" } as Record<string, string>)[appt.status]
                        : appt.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
    {showBookModal && (
      <BookAppointmentModal
        defaultPatientId={patientData?.id || user?.patientId}
        onClose={() => setShowBookModal(false)}
        onBooked={loadData}
      />
    )}
    </>
  );
}
