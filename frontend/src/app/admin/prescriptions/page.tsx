// ══════════════════════════════════════════════════════════════
// صفحه مدیریت نسخه‌ها (Prescriptions)
//
// اینجا دکتر می‌تونه:
// - لیست نسخه‌های صادرشده رو ببینه
// - جستجو کنه (با نام بیمار یا کد نسخه)
// - نسخه جدید صادر کنه (با مودال)
// - نسخه رو برای چاپ آماده کنه
//
// هر نسخه: کد یکتا (مثل RX-20240615-A3F2) + لیست داروها + وضعیت (فعال/منقضی/لغو)
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { Search, Plus, Pill, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { prescriptionApi } from "@/lib/api/axios";
import NewPrescriptionModal from "@/components/forms/NewPrescriptionModal";

export default function PrescriptionsPage() {
  const { lang } = useAppStore();
  const { user } = useAuthStore(); // برای درج نام پزشک روی برگه چاپ
  const t = useTranslations(lang);

  // State ها
  const [prescriptions, setPrescriptions] = useState<any[]>([]); // لیست نسخه‌ها
  const [loading, setLoading] = useState(true); // تا وقتی لیست نیومده، اسکلت نشون بده
  const [search, setSearch] = useState("");       // متن جستجو
  const [showForm, setShowForm] = useState(false); // نشون دادن مودال نسخه جدید

  const load = async () => {
    try {
      const { data } = await prescriptionApi.getAll();
      setPrescriptions(data || []);
    } catch {
      setPrescriptions([]);
      toast.error(lang === "fa" ? "دریافت نسخه‌ها ناموفق بود" : "Could not load prescriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── فیلتر نسخه‌ها بر اساس جستجو ────────────────────────────
  // toLowerCase چون کد نسخه انگلیسیه و کاربر ممکنه حروف کوچیک تایپ کنه
  const q = search.trim().toLowerCase();
  const filtered = q
    ? prescriptions.filter(p =>
        (p.patientName || "").toLowerCase().includes(q) ||
        (p.prescriptionCode || "").toLowerCase().includes(q) // کد نسخه مثل RX-20240615-A3F2
      )
    : prescriptions;

  // ─── تابع چاپ نسخه ────────────────────────────────────────────
  // به جای window.print() که کل صفحه (منو، هدر، بقیه نسخه‌ها) رو چاپ می‌کرد،
  // یه پنجره جدید باز می‌کنیم و فقط همین نسخه رو داخلش می‌سازیم.
  const handlePrint = (p: any) => {
    const fa = lang === "fa";
    const locale = fa ? "fa-IR" : "en-US";
    const fmt = (d: string) => (d ? new Date(d).toLocaleDateString(locale) : "—");
    // جلوگیری از تزریق HTML وقتی نام دارو/بیمار کاراکتر خاص داره
    const esc = (v: any) =>
      String(v ?? "").replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) {
      // بعضی مرورگرها پنجره جدید رو بلاک می‌کنن
      toast.error(fa ? "برای چاپ، اجازه باز شدن پنجره را بدهید" : "Please allow pop-ups to print");
      return;
    }

    const rows = (p.items || []).map((it: any, i: number) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(it.medicineName)}</strong>${it.instructions ? `<div class="hint">${esc(it.instructions)}</div>` : ""}</td>
        <td>${esc(it.dosage)}</td>
        <td>${esc(it.frequency)}</td>
        <td>${esc(it.duration)}</td>
        <td class="num">${esc(it.quantity ?? "")}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html>
<html lang="${fa ? "fa" : "en"}" dir="${fa ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${esc(p.prescriptionCode || (fa ? "نسخه" : "Prescription"))}</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif; color: #111827; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { font-size: 16px; margin: 0 0 4px; }
  .head .doc { color: #4b5563; font-size: 11px; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px;
          background: #f3f4f6; border-radius: 6px; padding: 4px 8px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 14px; }
  .meta div { font-size: 11px; color: #374151; }
  .meta span { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: ${fa ? "right" : "left"}; vertical-align: top; }
  th { background: #f9fafb; font-size: 11px; color: #374151; }
  td.num { text-align: center; width: 34px; }
  .hint { color: #6b7280; font-size: 10px; margin-top: 2px; }
  .notes { margin-top: 12px; font-size: 11px; }
  .notes b { display: block; margin-bottom: 3px; }
  .sign { margin-top: 34px; display: flex; justify-content: flex-end; }
  .sign div { width: 180px; border-top: 1px dashed #9ca3af; padding-top: 6px;
              text-align: center; font-size: 11px; color: #4b5563; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${fa ? "نسخه پزشکی" : "Medical Prescription"}</h1>
      <div class="doc">${esc(fa ? user?.fullName : (user?.fullNameEn || user?.fullName)) || ""}</div>
    </div>
    <div class="code">${esc(p.prescriptionCode || "")}</div>
  </div>

  <div class="meta">
    <div><span>${fa ? "بیمار:" : "Patient:"}</span> <strong>${esc(p.patientName)}</strong></div>
    <div><span>${fa ? "وضعیت:" : "Status:"}</span> ${esc(p.status)}</div>
    <div><span>${fa ? "تاریخ صدور:" : "Issued:"}</span> ${fmt(p.issuedDate)}</div>
    <div><span>${fa ? "تاریخ انقضا:" : "Expires:"}</span> ${fmt(p.expiryDate)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${fa ? "دارو" : "Medicine"}</th>
        <th>${fa ? "دوز" : "Dosage"}</th>
        <th>${fa ? "دفعات مصرف" : "Frequency"}</th>
        <th>${fa ? "مدت" : "Duration"}</th>
        <th class="num">${fa ? "تعداد" : "Qty"}</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#9ca3af">${fa ? "دارویی ثبت نشده" : "No medications"}</td></tr>`}</tbody>
  </table>

  ${p.notes ? `<div class="notes"><b>${fa ? "توضیحات:" : "Notes:"}</b>${esc(p.notes)}</div>` : ""}

  <div class="sign"><div>${fa ? "مهر و امضای پزشک" : "Doctor's signature & stamp"}</div></div>
</body>
</html>`);
    win.document.close();
    win.focus();
    // کمی صبر تا فونت/چیدمان آماده بشه، بعد پنجره چاپ باز بشه
    setTimeout(() => win.print(), 300);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان + دکمه نسخه جدید ────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.nav.prescriptions}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {lang === "fa" ? `${filtered.length} نسخه` : `${filtered.length} prescriptions`}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t.prescription.new}
          </button>
        </div>

        {/* ─── فیلد جستجو ──────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === "fa" ? "جستجو با نام بیمار یا کد نسخه..." : "Search by patient or code..."}
            className="input-field ps-11" />
        </div>

        {/* ─── لیست نسخه‌ها ────────────────────────────────────── */}
        <div className="space-y-3">
          {/* تا وقتی داده نیومده، اسکلت خاکستری نشون میدیم (نه چرخ‌دنده خالی) */}
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-gray-100 rounded" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}

          {!loading && filtered.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start gap-4">

                {/* آیکون قرص */}
                <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Pill className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* ردیف اول: نام بیمار، کد نسخه، وضعیت */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">{p.patientName}</span>
                    {/* کد نسخه با فونت کد (monospace) */}
                    <span className="badge badge-gray font-mono text-xs">{p.prescriptionCode}</span>
                    {/* وضعیت: فعال=سبز، منقضی=زرد، لغو=قرمز */}
                    <span className={`badge ${p.status === "Active" ? "badge-green" : p.status === "Expired" ? "badge-yellow" : "badge-red"}`}>
                      {lang === "fa"
                        ? ({ Active: "فعال", Expired: "منقضی", Cancelled: "لغو" } as Record<string, string>)[p.status]
                        : p.status}
                    </span>
                    {/* اگه واقعاً منقضی شده، badge اضافه نشون بده */}
                    {p.isExpired && <span className="badge badge-red text-[10px]">{lang === "fa" ? "منقضی شده" : "Expired"}</span>}
                  </div>

                  {/* تاریخ صدور و انقضا */}
                  <div className="text-xs text-gray-500 mt-1">
                    {lang === "fa" ? "تاریخ صدور:" : "Issued:"}{" "}
                    {new Date(p.issuedDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    {" "}·{" "}
                    {lang === "fa" ? "انقضا:" : "Expires:"}{" "}
                    {new Date(p.expiryDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                  </div>

                  {/* پیش‌نمایش داروها (حداکثر ۳ تا، بقیه "+X بیشتر") */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.items?.slice(0, 3).map((item: any, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded-lg px-2.5 py-1">
                        {item.medicineName} · {item.dosage} · {item.frequency}
                      </span>
                    ))}
                    {/* اگه بیش از ۳ دارو بود، تعداد باقیمانده رو نشون بده */}
                    {p.items?.length > 3 && (
                      <span className="text-xs text-gray-400">+{p.items.length - 3} {lang === "fa" ? "بیشتر" : "more"}</span>
                    )}
                  </div>
                </div>

                {/* دکمه چاپ - سمت راست کارت */}
                <button onClick={() => handlePrint(p)}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  title={lang === "fa" ? "چاپ" : "Print"}>
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* اگه هیچ نسخه‌ای پیدا نشد */}
          {!loading && filtered.length === 0 && (
            <div className="card flex flex-col items-center justify-center py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center mb-3">
                <Pill className="w-6 h-6" />
              </div>
              <p className="text-gray-900 font-medium">
                {search
                  ? (lang === "fa" ? "نسخه‌ای با این مشخصات پیدا نشد" : "No prescription matched your search")
                  : (lang === "fa" ? "هنوز نسخه‌ای صادر نشده است" : "No prescriptions issued yet")}
              </p>
              {!search && (
                <button onClick={() => setShowForm(true)} className="btn-secondary mt-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {t.prescription.new}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── مودال نسخه جدید ─────────────────────────────────── */}
      {showForm && (
        <NewPrescriptionModal
          lang={lang}
          t={t}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </AdminLayout>
  );
}
