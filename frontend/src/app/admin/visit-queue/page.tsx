"use client";

// ══════════════════════════════════════════════════════════════
// صفحه صف پذیرش حضوری (Visit Queue) — فقط برای منشی/پزشک
//
// از کنترلر بک‌اندی VisitQueueController استفاده می‌کنه که از قبل
// کاملاً پیاده‌سازی شده بود (شامل ماشین‌حالت VisitQueueWorkflow که
// گذارهای مجاز وضعیت رو کنترل می‌کنه) ولی هیچ رابط کاربری‌ای نداشت.
//
// جریان کار:
// ۱. منشی یه نوبت امروز رو "پذیرش" می‌کنه → وارد صف میشه (Waiting)
// ۲. وقتی نوبت بیمار رسید: "فراخوان" (Called)
// ۳. وقتی وارد مطب شد: "شروع ویزیت" (InVisit)
// ۴. وقتی ویزیت تموم شد: "پایان ویزیت" (Completed)
// در هر مرحله (جز بعد از پایان) میشه "غایب" یا "لغو" هم ثبت کرد
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { visitQueueApi, appointmentApi, branchApi } from "@/lib/api/axios";
import { ClipboardList, ShieldAlert, PhoneCall, PlayCircle, CheckCircle2, UserX, Ban, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";

interface QueueEntry {
  id: string; appointmentId: string; branchId?: string | null; queueNumber: number; status: string;
  checkedInAt?: string | null; calledAt?: string | null; startedAt?: string | null; completedAt?: string | null;
  notes?: string | null; patientName: string; startTime?: string | null; doctorId?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  CheckedIn: "badge-blue", Waiting: "badge-yellow", Called: "badge-blue",
  InVisit: "badge-green", Completed: "badge-gray", NoShow: "badge-red", Cancelled: "badge-red",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function VisitQueuePage() {
  const { lang } = useAppStore();
  const { user } = useAuthStore();
  const t = useTranslations(lang);
  const fa = lang === "fa";

  const [date, setDate] = useState(todayStr());
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});

  // ─── پنل پذیرش (چک‌این) ──────────────────────────────────────
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const loadQueue = () => {
    setLoading(true);
    visitQueueApi.getAll({ date, branchId: branchFilter || undefined })
      .then(({ data }) => { setQueue(data || []); setForbidden(false); })
      .catch((err) => {
        setQueue([]);
        if (err?.response?.status === 403) setForbidden(true);
        else toast.error(fa ? "دریافت صف پذیرش ناموفق بود" : "Could not load visit queue");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === "Patient") return;
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchFilter, user?.role]);

  useEffect(() => {
    branchApi.getAll().then(({ data }) => setBranches(data || [])).catch(() => {});
  }, []);

  const openCheckIn = () => {
    setShowCheckIn(true);
    appointmentApi.getAll({ from: date, to: date, pageSize: 100 })
      .then(({ data }) => setTodaysAppointments(data?.items || []))
      .catch(() => toast.error(fa ? "دریافت نوبت‌های امروز ناموفق بود" : "Could not load today's appointments"));
  };

  // نوبت‌هایی که هنوز وارد صف نشدن و لغو/تمام‌شده/غایب نیستن
  const queuedAppointmentIds = new Set(queue.map(q => q.appointmentId));
  const availableAppointments = todaysAppointments.filter(a =>
    !queuedAppointmentIds.has(a.id) && !["Cancelled", "Completed", "NoShow"].includes(a.status));

  const submitCheckIn = async () => {
    if (!selectedAppointmentId) {
      toast.error(t.visitQueue.selectAppointment);
      return;
    }
    setCheckingIn(true);
    try {
      await visitQueueApi.checkIn(selectedAppointmentId, checkInNotes.trim() || undefined);
      toast.success(fa ? "بیمار به صف اضافه شد" : "Patient added to queue");
      setShowCheckIn(false);
      setSelectedAppointmentId("");
      setCheckInNotes("");
      loadQueue();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "پذیرش ناموفق بود" : "Check-in failed"));
    } finally {
      setCheckingIn(false);
    }
  };

  const transition = async (entry: QueueEntry, status: string) => {
    setTransitioning(prev => ({ ...prev, [entry.id]: true }));
    try {
      await visitQueueApi.updateStatus(entry.id, status);
      loadQueue();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "تغییر وضعیت ناموفق بود" : "Could not update status"));
    } finally {
      setTransitioning(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  const statusLabel = (s: string) => (t.visitQueue.status as any)[s.charAt(0).toLowerCase() + s.slice(1)] || s;
  const fmtTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString(fa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

  if (user?.role === "Patient" || forbidden) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <p className="text-gray-900 font-semibold">{fa ? "دسترسی محدود شده" : "Access restricted"}</p>
        <p className="text-gray-500 text-sm mt-1">
          {fa ? "این صفحه فقط برای کادر درمان قابل مشاهده است" : "This page is only visible to clinic staff"}
        </p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              {t.visitQueue.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {fa ? `${queue.length.toLocaleString("fa-IR")} نفر در صف` : `${queue.length} in queue`}
            </p>
          </div>
          <button onClick={openCheckIn} className="btn-primary flex items-center gap-2 w-fit">
            <UserPlus className="w-4 h-4" />
            {t.visitQueue.checkIn}
          </button>
        </div>

        {/* ─── فیلترها ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field sm:max-w-[200px]" />
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="input-field sm:max-w-[220px]">
            <option value="">{t.inventory.allBranches}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* ─── جدول صف ─────────────────────────────────────────── */}
        <div className="card !p-0 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-16 text-gray-400">{t.visitQueue.empty}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{t.visitQueue.queueNumber}</th>
                    <th className="text-start">{t.billing.patient}</th>
                    <th className="text-start">{t.appointment.time}</th>
                    <th className="text-start">{t.common.status}</th>
                    <th className="text-start">{t.visitQueue.checkedInAt}</th>
                    <th className="text-start">{t.visitQueue.calledAt}</th>
                    <th className="text-start">{t.visitQueue.startedAt}</th>
                    <th className="text-start">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(entry => {
                    const busy = transitioning[entry.id];
                    return (
                      <tr key={entry.id}>
                        <td className="font-bold text-gray-900" dir="ltr">{entry.queueNumber}</td>
                        <td className="text-gray-700">{entry.patientName}</td>
                        <td className="text-gray-500 text-xs" dir="ltr">{entry.startTime || "—"}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[entry.status] || "badge-gray"}`}>
                            {statusLabel(entry.status)}
                          </span>
                        </td>
                        <td className="text-gray-500 text-xs" dir="ltr">{fmtTime(entry.checkedInAt)}</td>
                        <td className="text-gray-500 text-xs" dir="ltr">{fmtTime(entry.calledAt)}</td>
                        <td className="text-gray-500 text-xs" dir="ltr">{fmtTime(entry.startedAt)}</td>
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(entry.status === "Waiting" || entry.status === "CheckedIn") && (
                              <button disabled={busy} onClick={() => transition(entry, "Called")}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50" title={t.visitQueue.call}>
                                <PhoneCall className="w-4 h-4" />
                              </button>
                            )}
                            {entry.status === "Called" && (
                              <button disabled={busy} onClick={() => transition(entry, "InVisit")}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50" title={t.visitQueue.startVisit}>
                                <PlayCircle className="w-4 h-4" />
                              </button>
                            )}
                            {entry.status === "InVisit" && (
                              <button disabled={busy} onClick={() => transition(entry, "Completed")}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50" title={t.visitQueue.complete}>
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {(entry.status === "Waiting" || entry.status === "Called") && (
                              <button disabled={busy} onClick={() => transition(entry, "NoShow")}
                                className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50" title={t.visitQueue.noShow}>
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                            {!["Completed", "Cancelled", "NoShow"].includes(entry.status) && (
                              <button disabled={busy} onClick={() => transition(entry, "Cancelled")}
                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50" title={t.visitQueue.cancel}>
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── مودال پذیرش (چک‌این) ──────────────────────────────── */}
      {showCheckIn && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" dir={fa ? "rtl" : "ltr"}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t.visitQueue.checkIn}</h2>
              <button onClick={() => setShowCheckIn(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.visitQueue.selectAppointment}</label>
                <select value={selectedAppointmentId} onChange={e => setSelectedAppointmentId(e.target.value)} className="input-field">
                  <option value="">{fa ? "انتخاب کنید" : "Select..."}</option>
                  {availableAppointments.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.patientName} — {a.startTime} ({a.doctorName})
                    </option>
                  ))}
                </select>
                {availableAppointments.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">{fa ? "نوبت قابل پذیرشی برای امروز نیست" : "No appointments available to check in today"}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.appointment.notes}</label>
                <input value={checkInNotes} onChange={e => setCheckInNotes(e.target.value)} className="input-field" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCheckIn(false)} className="btn-secondary flex-1">{t.common.cancel}</button>
                <button onClick={submitCheckIn} disabled={checkingIn} className="btn-primary flex-1 disabled:opacity-60 flex items-center justify-center gap-2">
                  {checkingIn && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {t.visitQueue.checkIn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
