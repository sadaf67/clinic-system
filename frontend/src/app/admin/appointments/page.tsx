// ══════════════════════════════════════════════════════════════
// صفحه مدیریت نوبت‌ها
//
// اینجا دکتر یا منشی می‌تونه:
// - لیست همه نوبت‌ها رو با جدول ببینه
// - فیلتر بزنه: بر اساس وضعیت یا تاریخ
// - نوبت جدید ثبت کنه (با مودال)
// - وضعیت نوبت رو تغییر بده: تأیید / لغو / انجام شد
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { appointmentApi, integrationApi } from "@/lib/api/axios";
import toast from "react-hot-toast";
import { Calendar, Plus, Filter, RefreshCw, Download, Video, Copy, X } from "lucide-react";
import BookAppointmentModal from "@/components/forms/BookAppointmentModal";

// ─── نقشه رنگ وضعیت‌ها ────────────────────────────────────────
// هر وضعیت یه رنگ badge داره
const STATUS_COLORS: Record<string, string> = {
  Pending: "badge-yellow",    // در انتظار → زرد
  Confirmed: "badge-green",   // تأیید شده → سبز
  Cancelled: "badge-red",     // لغو شده → قرمز
  Completed: "badge-blue",    // انجام شده → آبی
  NoShow: "badge-gray",       // غایب → خاکستری
};

// ترجمه وضعیت‌ها به فارسی
const STATUS_FA: Record<string, string> = {
  Pending: "در انتظار",
  Confirmed: "تأیید شده",
  Cancelled: "لغو شده",
  Completed: "انجام شده",
  NoShow: "غایب",
};

export default function AppointmentsPage() {
  const { lang } = useAppStore();
  const t = useTranslations(lang);

  // State ها
  const [appointments, setAppointments] = useState<any[]>([]); // لیست نوبت‌ها
  const [total, setTotal] = useState(0);                        // کل تعداد
  const [page, setPage] = useState(1);                          // صفحه فعلی
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(""); // فیلتر وضعیت (خالی = همه)
  const [dateFilter, setDateFilter] = useState<string>("");     // فیلتر تاریخ
  const [showBookModal, setShowBookModal] = useState(false);    // نشون دادن مودال ثبت نوبت

  // ─── یکپارچه‌سازی‌ها: خروجی تقویم + جلسه ویزیت آنلاین ────────
  const [downloadingIcs, setDownloadingIcs] = useState<Record<string, boolean>>({});
  const [creatingSession, setCreatingSession] = useState<Record<string, boolean>>({});
  const [sessionModal, setSessionModal] = useState<{ joinUrl: string } | null>(null);

  // ─── بارگذاری نوبت‌ها از سرور ────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.getAll({
        page,
        pageSize: 15,
        status: statusFilter || undefined,  // اگه فیلتر خالی بود، ارسال نکن
        from: dateFilter || undefined,       // از این تاریخ
        to: dateFilter || undefined,         // تا این تاریخ (همون روز)
      });
      setAppointments(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      setAppointments([]);
      setTotal(0);
      toast.error(lang === "fa" ? "دریافت نوبت‌ها ناموفق بود" : "Could not load appointments");
    } finally {
      setLoading(false);
    }
  };

  // هر بار که فیلتر یا صفحه عوض شد، دوباره بارگذاری کن
  useEffect(() => { load(); }, [page, statusFilter, dateFilter]);

  // ─── تابع تغییر وضعیت نوبت ───────────────────────────────────
  // وقتی دکتر/منشی روی "تأیید" یا "لغو" یا "ویزیت شد" کلیک می‌کنه
  const updateStatus = async (id: string, status: string) => {
    try {
      await appointmentApi.updateStatus(id, { status }); // به سرور بفرست
      toast.success(lang === "fa" ? "وضعیت بروزرسانی شد" : "Status updated"); // پیام موفقیت
      load(); // لیست رو دوباره بارگذاری کن
    } catch {
      toast.error(lang === "fa" ? "خطا در بروزرسانی" : "Update failed");
    }
  };

  // ─── دانلود خروجی تقویم (.ics) ────────────────────────────────
  // چون اندپوینت نیاز به توکن داره، با axios (blob) می‌گیریم و بعد
  // با یه لینک موقت روی مرورگر دانلودش می‌کنیم — نه یه لینک ساده
  const downloadIcs = async (appt: any) => {
    setDownloadingIcs(prev => ({ ...prev, [appt.id]: true }));
    try {
      const res = await integrationApi.downloadCalendar(appt.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/calendar" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointment-${appt.id}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(lang === "fa" ? "دانلود تقویم ناموفق بود" : "Could not download calendar file");
    } finally {
      setDownloadingIcs(prev => ({ ...prev, [appt.id]: false }));
    }
  };

  // ─── ایجاد جلسه ویزیت آنلاین ──────────────────────────────────
  const createSession = async (appt: any) => {
    setCreatingSession(prev => ({ ...prev, [appt.id]: true }));
    try {
      const { data } = await integrationApi.createTelemedicineSession(appt.id);
      setSessionModal({ joinUrl: data.joinUrl });
      toast.success(t.integration.sessionCreated);
    } catch (error: any) {
      if (error?.response?.status === 409) toast.error(t.integration.notConfigured);
      else toast.error(error?.response?.data?.message || (lang === "fa" ? "ایجاد جلسه ناموفق بود" : "Could not create session"));
    } finally {
      setCreatingSession(prev => ({ ...prev, [appt.id]: false }));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان + دکمه نوبت جدید ─────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav.appointments}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {lang === "fa" ? `مجموع: ${total.toLocaleString("fa-IR")} نوبت` : `Total: ${total} appointments`}
            </p>
          </div>
          {/* با کلیک مودال ثبت نوبت باز میشه */}
          <button onClick={() => setShowBookModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t.appointment.new}
          </button>
        </div>

        {/* ─── فیلترها ─────────────────────────────────────────── */}
        <div className="card py-4 flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />

          {/* منوی وضعیت */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }} // صفحه رو ریست کن
            className="input-field w-auto text-sm"
          >
            <option value="">{lang === "fa" ? "همه وضعیت‌ها" : "All Statuses"}</option>
            {Object.entries(STATUS_FA).map(([k, v]) => (
              <option key={k} value={k}>{lang === "fa" ? v : k}</option>
            ))}
          </select>

          {/* انتخاب تاریخ */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="input-field w-auto text-sm"
            dir="ltr" // تقویم همیشه ltr
          />

          {/* دکمه پاک کردن فیلترها - فقط وقتی فیلتر فعال هست */}
          {(statusFilter || dateFilter) && (
            <button onClick={() => { setStatusFilter(""); setDateFilter(""); setPage(1); }}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === "fa" ? "پاک کردن فیلتر" : "Clear filters"}
            </button>
          )}
        </div>

        {/* ─── جدول نوبت‌ها ────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                {/* ستون‌ها: بیمار، تاریخ، ساعت، نوع، شکایت، وضعیت، دکمه‌ها */}
                {/* توجه: کامنت یا فاصله بین <th>ها باعث خطای hydration میشه */}
                <tr>
                  <th className="text-start">{t.patient.title}</th>
                  <th className="text-start">{t.common.date}</th>
                  <th className="text-start">{t.common.time}</th>
                  <th className="text-start">{t.appointment.type}</th>
                  <th className="text-start">{t.appointment.chiefComplaint}</th>
                  <th className="text-start">{t.common.status}</th>
                  <th className="text-start">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // در حال لود: یه ردیف با اسپینر
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        {t.common.loading}
                      </div>
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">{t.common.noData}</td></tr>
                ) : appointments.map(appt => (
                  <tr key={appt.id}>
                    {/* نام و شماره بیمار */}
                    <td>
                      <div className="font-medium text-gray-900">{appt.patientName}</div>
                      <div className="text-xs text-gray-400" dir="ltr">{appt.patientPhone}</div>
                    </td>

                    {/* تاریخ نوبت - به قالب محلی */}
                    <td className="text-gray-600">
                      {new Date(appt.appointmentDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    </td>

                    {/* ساعت - همیشه ltr (09:30) */}
                    <td className="text-gray-600 tabular-nums" dir="ltr">
                      {appt.startTime?.slice(0, 5)}
                    </td>

                    {/* نوع ویزیت: آنلاین یا حضوری */}
                    <td>
                      <span className={`badge ${appt.type === "Online" ? "badge-blue" : "badge-gray"}`}>
                        {appt.type === "Online"
                          ? (lang === "fa" ? "آنلاین" : "Online")
                          : (lang === "fa" ? "حضوری" : "In-Person")}
                      </span>
                    </td>

                    {/* شکایت اصلی - اگه بلند بود ... میذاره */}
                    <td className="max-w-[180px] truncate text-gray-500 text-xs">
                      {appt.chiefComplaint || "—"}
                    </td>

                    {/* وضعیت با رنگ مناسب */}
                    <td>
                      <span className={STATUS_COLORS[appt.status] || "badge-gray"}>
                        {lang === "fa" ? STATUS_FA[appt.status] : appt.status}
                      </span>
                    </td>

                    {/* دکمه‌های عملیات */}
                    <td>
                      <div className="flex gap-1">
                        {/* دکمه تأیید: فقط وقتی نوبت "در انتظار" هست */}
                        {appt.status === "Pending" && (
                          <button
                            onClick={() => updateStatus(appt.id, "Confirmed")}
                            className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition">
                            {lang === "fa" ? "تأیید" : "Confirm"}
                          </button>
                        )}
                        {/* دکمه لغو: نشون داده نمیشه اگه قبلاً لغو یا تموم شده */}
                        {appt.status !== "Cancelled" && appt.status !== "Completed" && (
                          <button
                            onClick={() => updateStatus(appt.id, "Cancelled")}
                            className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
                            {lang === "fa" ? "لغو" : "Cancel"}
                          </button>
                        )}
                        {/* دکمه "ویزیت شد": فقط بعد از تأیید */}
                        {appt.status === "Confirmed" && (
                          <button
                            onClick={() => updateStatus(appt.id, "Completed")}
                            className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">
                            {lang === "fa" ? "ویزیت شد" : "Complete"}
                          </button>
                        )}
                        {/* دانلود خروجی تقویم - برای هر نوبت لغونشده */}
                        {appt.status !== "Cancelled" && (
                          <button
                            onClick={() => downloadIcs(appt)} disabled={downloadingIcs[appt.id]}
                            title={t.integration.exportCalendar}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-50">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* ایجاد جلسه ویزیت آنلاین - فقط نوبت‌های آنلاینِ لغونشده */}
                        {appt.type === "Online" && appt.status !== "Cancelled" && (
                          <button
                            onClick={() => createSession(appt)} disabled={creatingSession[appt.id]}
                            title={t.integration.createSession}
                            className="p-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition disabled:opacity-50">
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─── صفحه‌بندی ─────────────────────────────────────── */}
          {total > 15 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              {/* نشون میده "نمایش ۱ تا ۱۵ از ۴۵" */}
              <span>
                {lang === "fa"
                  ? `نمایش ${((page - 1) * 15 + 1).toLocaleString("fa-IR")} تا ${Math.min(page * 15, total).toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")}`
                  : `Showing ${(page - 1) * 15 + 1}–${Math.min(page * 15, total)} of ${total}`}
              </span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  {lang === "fa" ? "قبلی" : "Prev"}
                </button>
                <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
                  {lang === "fa" ? "بعدی" : "Next"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── مودال ثبت نوبت جدید ─────────────────────────────── */}
      {/* فقط وقتی showBookModal = true نشون داده میشه */}
      {showBookModal && (
        <BookAppointmentModal
          onClose={() => setShowBookModal(false)}            // بستن مودال
          onBooked={() => { setShowBookModal(false); load(); }} // بعد از ثبت: بستن + رفرش
        />
      )}

      {/* ─── مودال لینک جلسه ویزیت آنلاین ────────────────────── */}
      {sessionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir={lang === "fa" ? "rtl" : "ltr"}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t.integration.createSession}</h2>
              <button onClick={() => setSessionModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.integration.joinUrl}</label>
                <div className="flex gap-2">
                  <input readOnly value={sessionModal.joinUrl} className="input-field text-xs" dir="ltr" />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sessionModal.joinUrl);
                      toast.success(t.integration.linkCopied);
                    }}
                    className="btn-secondary px-3 shrink-0">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button onClick={() => setSessionModal(null)} className="btn-primary w-full">{t.common.close}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
