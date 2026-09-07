// ══════════════════════════════════════════════════════════════
// صفحه لاگ فعالیت (Audit Trail) — فقط برای SuperAdmin (پزشک)
//
// این صفحه از یه قابلیت بک‌اندی استفاده می‌کنه که از قبل کاملاً
// پیاده‌سازی شده بود ولی هیچ رابط کاربری‌ای نداشت:
// هر بار هر رکوردی (بیمار، نوبت، نسخه، پرونده پزشکی و...) توی
// دیتابیس اضافه/ویرایش/حذف بشه، یه لاگ خودکار ثبت میشه —
// اینجا فقط اون لاگ‌ها رو به شکل قابل‌فهم نشون می‌دیم.
//
// چرا برای اعتماد پزشک به سیستم مهمه؟
// توی سیستم‌های پزشکی، مهم‌ترین دغدغه اینه که «کی، کِی، چه
// تغییری توی پرونده‌ها داده». این صفحه دقیقاً همون رو نشون میده.
// ══════════════════════════════════════════════════════════════
"use client";
import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/store/useStore";
import { auditApi } from "@/lib/api/axios";
import { History, PlusCircle, Pencil, Trash2, ChevronDown, Search, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

interface AuditLogItem {
  id: string;
  actorUserId?: string | null;
  actorName: string;
  action: string;        // Added | Modified | Deleted
  entityType: string;    // مثل Patient، Appointment، Prescription
  entityId: string;
  oldValuesJson?: string | null;
  newValuesJson?: string | null;
  ipAddress?: string | null;
  correlationId?: string;
  createdAt: string;
}

// ترجمه نوع رکورد (نام کلاس C# → متن قابل‌فهم)
const ENTITY_LABEL: Record<string, { fa: string; en: string }> = {
  Patient:        { fa: "بیمار",          en: "Patient" },
  User:           { fa: "کاربر",          en: "User" },
  Appointment:    { fa: "نوبت",           en: "Appointment" },
  Prescription:   { fa: "نسخه",           en: "Prescription" },
  MedicalRecord:  { fa: "پرونده پزشکی",   en: "Medical Record" },
  Consultation:   { fa: "مشاوره",         en: "Consultation" },
  Notification:   { fa: "اعلان",          en: "Notification" },
  Branch:         { fa: "شعبه",           en: "Branch" },
  WorkSchedule:   { fa: "برنامه کاری",    en: "Work Schedule" },
  DayOff:         { fa: "روز تعطیل",      en: "Day Off" },
  Invoice:        { fa: "فاکتور",         en: "Invoice" },
  Payment:        { fa: "پرداخت",         en: "Payment" },
  InventoryItem:  { fa: "قلم انبار",       en: "Inventory Item" },
  MedicalFile:    { fa: "فایل پزشکی",     en: "Medical File" },
};

// ظاهر هر نوع عملیات
const ACTION_STYLE: Record<string, { fa: string; en: string; badge: string; icon: React.ReactNode }> = {
  Added:    { fa: "افزوده شد", en: "Added",    badge: "badge-green",  icon: <PlusCircle className="w-3.5 h-3.5" /> },
  Modified: { fa: "ویرایش شد", en: "Modified", badge: "badge-blue",   icon: <Pencil className="w-3.5 h-3.5" /> },
  Deleted:  { fa: "حذف شد",   en: "Deleted",   badge: "badge-red",    icon: <Trash2 className="w-3.5 h-3.5" /> },
};

const PAGE_SIZE = 30;

export default function AuditPage() {
  const { lang } = useAppStore();
  const fa = lang === "fa";

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");     // فیلتر سریع سمت کلاینت روی صفحه فعلی
  const [expanded, setExpanded] = useState<string | null>(null); // ردیفی که جزئیاتش بازه
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    auditApi.getAll({ page, pageSize: PAGE_SIZE, entityType: entityType || undefined })
      .then(({ data }) => {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setForbidden(false);
      })
      .catch((err) => {
        setItems([]);
        setTotal(0);
        // این صفحه فقط برای SuperAdmin مجازه؛ اگه منشی (Admin) مستقیم لینک رو باز کنه، ۴۰۳ می‌گیره
        if (err?.response?.status === 403) setForbidden(true);
        else toast.error(fa ? "دریافت لاگ فعالیت ناموفق بود" : "Could not load activity log");
      })
      .finally(() => setLoading(false));
  }, [page, entityType, fa]);

  useEffect(() => { setPage(1); }, [entityType]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter(i =>
        i.actorName?.toLowerCase().includes(q) ||
        i.entityType?.toLowerCase().includes(q) ||
        i.entityId?.toLowerCase().includes(q))
    : items;

  // ─── تبدیل رشته JSON مقادیر به لیست { کلید، مقدار } برای نمایش ──
  const parseValues = (json?: string | null): Record<string, any> => {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
  };

  // چیدن مقادیر قبل/بعد کنار هم برای نمایش تغییرات
  const renderDiff = (log: AuditLogItem) => {
    const oldV = parseValues(log.oldValuesJson);
    const newV = parseValues(log.newValuesJson);
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
    if (keys.length === 0) {
      return <div className="text-xs text-gray-400">{fa ? "جزئیاتی ثبت نشده" : "No details recorded"}</div>;
    }
    return (
      <div className="space-y-1.5">
        {keys.map(k => (
          <div key={k} className="grid grid-cols-3 gap-2 text-xs">
            <span className="text-gray-500 font-medium truncate">{k}</span>
            {log.action === "Modified" ? (
              <>
                <span className="text-red-500 truncate line-through decoration-red-300">{String(oldV[k] ?? "—")}</span>
                <span className="text-green-600 truncate">{String(newV[k] ?? "—")}</span>
              </>
            ) : (
              <span className="text-gray-700 col-span-2 truncate">
                {String((log.action === "Deleted" ? oldV[k] : newV[k]) ?? "—")}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const entityLabel = (type: string) => (ENTITY_LABEL[type] ? ENTITY_LABEL[type][fa ? "fa" : "en"] : type);
  const actionInfo = (action: string) => ACTION_STYLE[action] ?? { fa: action, en: action, badge: "badge-gray", icon: <History className="w-3.5 h-3.5" /> };

  // ─── حالت عدم دسترسی (فقط پزشک/SuperAdmin مجازه) ─────────────
  if (forbidden) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <p className="text-gray-900 font-semibold">{fa ? "دسترسی محدود شده" : "Access restricted"}</p>
        <p className="text-gray-500 text-sm mt-1">
          {fa ? "لاگ فعالیت فقط برای پزشک (سوپر ادمین) قابل مشاهده است" : "The activity log is only visible to the Doctor (Super Admin)"}
        </p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان ───────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            {fa ? "لاگ فعالیت" : "Activity Log"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {fa ? "تاریخچه کامل تغییرات ثبت‌شده در سامانه — چه کسی، چه زمانی، چه تغییری داد" : "Full history of changes made in the system — who, when, what"}
          </p>
        </div>

        {/* ─── فیلترها ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={fa ? "جستجو با نام کاربر یا نوع رکورد..." : "Search by user or record type..."}
              className="input-field ps-11" />
          </div>
          <select value={entityType} onChange={e => setEntityType(e.target.value)} className="input-field sm:max-w-[220px]">
            <option value="">{fa ? "همه نوع رکوردها" : "All record types"}</option>
            {Object.entries(ENTITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label[fa ? "fa" : "en"]}</option>
            ))}
          </select>
        </div>

        {/* ─── جدول لاگ‌ها ─────────────────────────────────────── */}
        <div className="card !p-0 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {fa ? "رویدادی یافت نشد" : "No events found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{fa ? "زمان" : "Time"}</th>
                    <th className="text-start">{fa ? "کاربر" : "User"}</th>
                    <th className="text-start">{fa ? "عملیات" : "Action"}</th>
                    <th className="text-start">{fa ? "نوع رکورد" : "Record Type"}</th>
                    <th className="text-start"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => {
                    const info = actionInfo(log.action);
                    const isOpen = expanded === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr onClick={() => setExpanded(isOpen ? null : log.id)} className="cursor-pointer">
                          <td className="text-gray-500 text-xs whitespace-nowrap" dir="ltr">
                            {new Date(log.createdAt).toLocaleString(fa ? "fa-IR" : "en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </td>
                          <td className="font-medium text-gray-900">{log.actorName || (fa ? "سیستم" : "system")}</td>
                          <td>
                            <span className={`badge flex items-center gap-1 w-fit ${info.badge}`}>
                              {info.icon}{info[fa ? "fa" : "en"]}
                            </span>
                          </td>
                          <td className="text-gray-700">
                            {entityLabel(log.entityType)}
                            <span className="text-gray-400 text-xs ms-1.5" dir="ltr">#{log.entityId?.slice(0, 8)}</span>
                          </td>
                          <td>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="bg-gray-50/70 !py-3">
                              {renderDiff(log)}
                              {log.ipAddress && (
                                <div className="text-[11px] text-gray-400 mt-2" dir="ltr">IP: {log.ipAddress}</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── صفحه‌بندی ───────────────────────────────────────── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition">
              {fa ? "قبلی" : "Prev"}
            </button>
            <span className="text-sm text-gray-500 px-2">
              {fa ? `صفحه ${page.toLocaleString("fa-IR")}` : `Page ${page}`}
            </span>
            <button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50 transition">
              {fa ? "بعدی" : "Next"}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
