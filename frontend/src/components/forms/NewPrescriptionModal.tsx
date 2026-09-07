"use client";

// ══════════════════════════════════════════════════════════════
// فرم صدور نسخه جدید (پنجره پاپ‌آپ) — کامپوننت مشترک
//
// از دو جا استفاده میشه:
// ۱. صفحه لیست نسخه‌ها (admin/prescriptions) — بدون بیمار پیش‌فرض
// ۲. صفحه پرونده یه بیمار خاص (admin/patients/[id]) — با defaultPatientId
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { patientApi, prescriptionApi } from "@/lib/api/axios";

export default function NewPrescriptionModal({
  lang, t, onClose, onSaved, defaultPatientId,
}: {
  lang: string;
  t: any;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string;
}) {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState(defaultPatientId || "");
  const [validDays, setValidDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // داروهای نسخه جدید (هر بار دکمه "افزودن دارو" زده میشه یه ردیف اضافه میشه)
  const [items, setItems] = useState([{
    medicineName: "",  // نام دارو
    dosage: "",        // دوز (مثلاً ۵۰۰mg)
    frequency: "",     // دفعات مصرف (مثلاً ۳ بار در روز)
    duration: "",      // مدت (مثلاً ۷ روز)
    quantity: 1,       // تعداد
    instructions: ""   // دستور مصرف اضافی
  }]);

  useEffect(() => {
    patientApi.getAll({ page: 1, pageSize: 100 })
      .then(res => setPatients(res.data?.items || []))
      .catch(() => toast.error(lang === "fa" ? "دریافت بیماران ناموفق بود" : "Could not load patients"));
  }, [lang]);

  // ─── اضافه کردن ردیف دارو جدید ──────────────────────────────
  const addItem = () => setItems(prev => [...prev, {
    medicineName: "", dosage: "", frequency: "", duration: "", quantity: 1, instructions: ""
  }]);

  // ─── حذف یه ردیف دارو ────────────────────────────────────────
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const savePrescription = async () => {
    if (!patientId || items.some(item => !item.medicineName || !item.dosage || !item.frequency || !item.duration)) {
      toast.error(lang === "fa" ? "بیمار و اطلاعات همه داروها الزامی است" : "Patient and all medication fields are required");
      return;
    }

    setSaving(true);
    try {
      await prescriptionApi.create({ patientId, validDays, notes: notes || null, items });
      toast.success(lang === "fa" ? "نسخه ذخیره شد" : "Prescription saved");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "ثبت نسخه ناموفق بود" : "Could not save prescription"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

        {/* هدر مودال */}
        {/* sticky = این مودال بلندترین لیست دارو رو داره؛ هدر و دکمه بستن باید حین اسکرول در دسترس بمونن */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{t.prescription.new}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* جستجوی بیمار */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {lang === "fa" ? "بیمار" : "Patient"}
            </label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input-field">
              <option value="">{lang === "fa" ? "انتخاب بیمار" : "Select patient"}</option>
              {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}
            </select>
          </div>

          {/* اعتبار نسخه + یادداشت */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {lang === "fa" ? "اعتبار (روز)" : "Valid (days)"}
              </label>
              {/* پیش‌فرض: ۳۰ روز = یه ماه */}
              <input type="number" min={1} value={validDays} onChange={e => setValidDays(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {lang === "fa" ? "یادداشت" : "Notes"}
              </label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder={lang === "fa" ? "یادداشت..." : "Notes..."} />
            </div>
          </div>

          {/* ─── بخش داروها ─────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">
                {lang === "fa" ? "داروها" : "Medications"}
              </label>
              {/* دکمه افزودن دارو جدید */}
              <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                {lang === "fa" ? "افزودن دارو" : "Add medicine"}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                // کارت هر دارو
                <div key={i} className="border border-gray-200 rounded-xl p-4 relative">
                  {/* دکمه حذف این دارو - فقط اگه بیشتر از یه دارو داشتیم */}
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)}
                      className="absolute top-3 end-3 text-gray-300 hover:text-red-400 transition">
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* فیلدهای دارو: نام، دوز، دفعات، مدت */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t.prescription.medicine}</label>
                      <input value={item.medicineName}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, medicineName: e.target.value } : it))}
                        className="input-field text-sm" placeholder={lang === "fa" ? "نام دارو" : "Medicine name"} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t.prescription.dosage}</label>
                      <input value={item.dosage}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, dosage: e.target.value } : it))}
                        className="input-field text-sm" placeholder={lang === "fa" ? "مثال: ۵۰۰mg" : "e.g. 500mg"} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t.prescription.frequency}</label>
                      <input value={item.frequency}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, frequency: e.target.value } : it))}
                        className="input-field text-sm" placeholder={lang === "fa" ? "مثال: ۳ بار در روز" : "e.g. 3 times/day"} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t.prescription.duration}</label>
                      <input value={item.duration}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, duration: e.target.value } : it))}
                        className="input-field text-sm" placeholder={lang === "fa" ? "مثال: ۷ روز" : "e.g. 7 days"} />
                    </div>
                  </div>

                  {/* دستور مصرف اضافی */}
                  <div className="mt-2">
                    <label className="text-xs text-gray-500 mb-1 block">{t.prescription.instructions}</label>
                    <input value={item.instructions}
                      onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, instructions: e.target.value } : it))}
                      className="input-field text-sm" placeholder={lang === "fa" ? "دستور مصرف..." : "Instructions..."} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* دکمه‌های لغو/ذخیره */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              {t.common.cancel}
            </button>
            <button onClick={savePrescription} disabled={saving}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
