"use client";

// ══════════════════════════════════════════════════════════════
// فرم صدور فاکتور جدید (پنجره پاپ‌آپ) — کامپوننت مشترک
//
// از صفحه لیست فاکتورها (admin/billing) استفاده میشه.
// شبیه به NewPrescriptionModal.tsx ساخته شده: بیمار + ردیف‌های
// دینامیک (اینجا "اقلام فاکتور" به‌جای "داروها")
// ══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { patientApi, billingApi } from "@/lib/api/axios";

export default function NewInvoiceModal({
  lang, t, onClose, onSaved, defaultPatientId,
}: {
  lang: string;
  t: any;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string;
}) {
  const fa = lang === "fa";
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState(defaultPatientId || "");
  const [dueAt, setDueAt] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [insuranceAmount, setInsuranceAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // اقلام فاکتور (هر بار دکمه "افزودن قلم" زده میشه یه ردیف اضافه میشه)
  const [items, setItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    patientApi.getAll({ page: 1, pageSize: 100 })
      .then(res => setPatients(res.data?.items || []))
      .catch(() => toast.error(fa ? "دریافت بیماران ناموفق بود" : "Could not load patients"));
  }, [fa]);

  const addItem = () => setItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  // ─── پیش‌نمایش زنده جمع کل (فقط نمایشی؛ محاسبه نهایی سمت سرور انجام میشه) ──
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0),
    [items]
  );
  const total = Math.max(0, subtotal - (Number(discountAmount) || 0) - (Number(insuranceAmount) || 0));

  const saveInvoice = async () => {
    if (!patientId || items.some(it => !it.description.trim() || Number(it.quantity) <= 0 || Number(it.unitPrice) < 0)) {
      toast.error(fa ? "بیمار و اطلاعات همه اقلام فاکتور الزامی است" : "Patient and all invoice items are required");
      return;
    }

    setSaving(true);
    try {
      await billingApi.createInvoice({
        patientId,
        appointmentId: null,
        branchId: null,
        dueAt: dueAt || null,
        discountAmount: Number(discountAmount) || 0,
        insuranceAmount: Number(insuranceAmount) || 0,
        notes: notes.trim() || null,
        items: items.map(it => ({ description: it.description.trim(), quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
      });
      toast.success(fa ? "فاکتور ثبت شد" : "Invoice created");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "ثبت فاکتور ناموفق بود" : "Could not create invoice"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir={fa ? "rtl" : "ltr"}>

        {/* هدر مودال */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{t.billing.new}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* بیمار */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.billing.patient}</label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input-field">
              <option value="">{fa ? "انتخاب بیمار" : "Select patient"}</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>

          {/* سررسید + یادداشت */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.billing.dueAt}</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.billing.notes}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder={fa ? "یادداشت..." : "Notes..."} />
            </div>
          </div>

          {/* تخفیف + سهم بیمه */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.billing.discount}</label>
              <input type="number" min={0} value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.billing.insuranceAmount}</label>
              <input type="number" min={0} value={insuranceAmount} onChange={e => setInsuranceAmount(Number(e.target.value))} className="input-field" />
            </div>
          </div>

          {/* ─── اقلام فاکتور ─────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">{t.billing.items}</label>
              <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                {t.billing.addItem}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 relative">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)}
                      className="absolute top-3 end-3 text-gray-300 hover:text-red-400 transition">
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 mb-1 block">{t.billing.description}</label>
                      <input value={item.description}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                        className="input-field text-sm" placeholder={fa ? "شرح خدمت یا کالا" : "Service or item description"} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t.billing.quantity}</label>
                      <input type="number" min={1} value={item.quantity}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it))}
                        className="input-field text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">{t.billing.unitPrice}</label>
                      <input type="number" min={0} value={item.unitPrice}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unitPrice: Number(e.target.value) } : it))}
                        className="input-field text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* پیش‌نمایش جمع کل */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">{t.billing.total}</span>
            <span className="font-bold text-gray-900" dir="ltr">{total.toLocaleString(fa ? "fa-IR" : "en-US")}</span>
          </div>

          {/* دکمه‌های لغو/ذخیره */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button onClick={saveInvoice} disabled={saving}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? (fa ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
