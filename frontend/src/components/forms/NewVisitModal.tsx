"use client";

// ══════════════════════════════════════════════════════════════
// فرم ثبت ویزیت جدید (پنجره پاپ‌آپ) — کامپوننت مشترک
// شامل: انتخاب بیمار + علائم حیاتی + اطلاعات بالینی
//
// از دو جا استفاده میشه:
// ۱. صفحه لیست پرونده‌های پزشکی (admin/medical-records) — بدون بیمار پیش‌فرض
// ۲. صفحه پرونده یه بیمار خاص (admin/patients/[id]) — با defaultPatientId
//    که در این حالت بیمار از قبل انتخاب شده و قابل تغییره
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Activity, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { patientApi, medicalRecordApi } from "@/lib/api/axios";

export default function NewVisitModal({
  lang, t, onClose, onSaved, defaultPatientId,
}: {
  lang: string;
  t: any;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string; // اگه از صفحه یه بیمار خاص باز شده باشه
}) {
  // همه فیلدهای فرم در یه آبجکت
  const [form, setForm] = useState({
    patientId: defaultPatientId || "",
    chiefComplaint: "",       // شکایت اصلی
    diagnosis: "",            // تشخیص
    diagnosisCode: "",        // کد ICD-10
    treatmentPlan: "",        // طرح درمان
    doctorNotes: "",          // یادداشت پزشک
    followUpInstructions: "", // دستورالعمل پیگیری
    nextVisitDate: "",        // تاریخ ویزیت بعدی
    weight: "",               // وزن
    height: "",               // قد
    bpSys: "",                // فشار سیستولیک
    bpDia: "",                // فشار دیاستولیک
    heartRate: "",            // ضربان قلب
    temperature: "",          // دما
    oxygenSat: "",            // اشباع اکسیژن
    bloodSugar: "",           // قند خون
  });
  const [patients, setPatients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    patientApi.getAll({ page: 1, pageSize: 100 })
      .then(res => setPatients(res.data?.items || []))
      .catch(() => toast.error(lang === "fa" ? "دریافت بیماران ناموفق بود" : "Could not load patients"));
  }, [lang]);

  // یه helper کوچک برای آپدیت راحت‌تر هر فیلد
  // به جای نوشتن: onChange={e => setForm(f => ({...f, weight: e.target.value}))}
  // می‌نویسیم: onChange={set("weight")}
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.patientId || !form.diagnosis.trim()) {
      toast.error(lang === "fa" ? "بیمار و تشخیص الزامی است" : "Patient and diagnosis are required");
      return;
    }

    const numberOrNull = (value: string) => value === "" ? null : Number(value);
    setSaving(true);
    try {
      await medicalRecordApi.create({
        patientId: form.patientId,
        chiefComplaint: form.chiefComplaint || null,
        diagnosis: form.diagnosis,
        diagnosisCode: form.diagnosisCode || null,
        treatmentPlan: form.treatmentPlan || null,
        doctorNotes: form.doctorNotes || null,
        followUpInstructions: form.followUpInstructions || null,
        nextVisitDate: form.nextVisitDate || null,
        weight: numberOrNull(form.weight),
        height: numberOrNull(form.height),
        bloodPressureSystolic: numberOrNull(form.bpSys),
        bloodPressureDiastolic: numberOrNull(form.bpDia),
        heartRate: numberOrNull(form.heartRate),
        temperature: numberOrNull(form.temperature),
        oxygenSaturation: numberOrNull(form.oxygenSat),
        bloodSugar: numberOrNull(form.bloodSugar),
      });
      toast.success(lang === "fa" ? "ویزیت ثبت شد" : "Visit saved");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "ثبت ویزیت ناموفق بود" : "Could not save visit"));
    } finally {
      setSaving(false);
    }
  };

  return (
    // پس‌زمینه تیره پشت مودال (backdrop)
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* جعبه اصلی مودال */}
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

        {/* هدر مودال - sticky = وقتی اسکرول می‌کنی بالا می‌مونه */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {lang === "fa" ? "ثبت ویزیت جدید" : "New Visit Record"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* ─── انتخاب بیمار ───────────────────────────────── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              {lang === "fa" ? "بیمار" : "Patient"} *
            </label>
            <select value={form.patientId} onChange={set("patientId")} className="input-field">
              <option value="">{lang === "fa" ? "انتخاب بیمار" : "Select patient"}</option>
              {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}
            </select>
          </div>

          {/* ─── علائم حیاتی ─────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              {t.patient.vitalSigns}
            </h3>
            {/* ۸ فیلد عددی در یه گرید */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "weight",      label: lang === "fa" ? "وزن (kg)"          : "Weight (kg)",    type: "number" },
                { key: "height",      label: lang === "fa" ? "قد (cm)"            : "Height (cm)",    type: "number" },
                { key: "bpSys",       label: lang === "fa" ? "فشار سیستولیک"     : "BP Systolic",    type: "number" },
                { key: "bpDia",       label: lang === "fa" ? "فشار دیاستولیک"    : "BP Diastolic",   type: "number" },
                { key: "heartRate",   label: lang === "fa" ? "ضربان قلب"          : "Heart Rate",     type: "number" },
                { key: "temperature", label: lang === "fa" ? "دما (°C)"           : "Temp (°C)",      type: "number" },
                { key: "oxygenSat",   label: lang === "fa" ? "اشباع O₂ (%)"      : "O₂ Sat (%)",    type: "number" },
                { key: "bloodSugar",  label: lang === "fa" ? "قند خون"            : "Blood Sugar",    type: "number" },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                  <input type={field.type} value={(form as any)[field.key]} onChange={set(field.key)}
                    className="input-field text-sm" dir="ltr" />
                </div>
              ))}
            </div>

            {/* BMI خودکار محاسبه می‌شه وقتی وزن و قد وارد شده */}
            {form.weight && form.height && +form.height > 0 && (
              <div className="mt-2 text-xs text-blue-600 font-medium">
                BMI: {(+form.weight / Math.pow(+form.height / 100, 2)).toFixed(1)} kg/m²
                {/* فرمول BMI: وزن ÷ (قد به متر)² */}
              </div>
            )}
          </div>

          {/* ─── اطلاعات بالینی ──────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              {lang === "fa" ? "اطلاعات بالینی" : "Clinical Information"}
            </h3>

            {/* شکایت اصلی */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t.appointment.chiefComplaint}</label>
              <input value={form.chiefComplaint} onChange={set("chiefComplaint")} className="input-field text-sm" />
            </div>

            {/* تشخیص + کد ICD-10 در کنار هم */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "تشخیص" : "Diagnosis"} *</label>
                <input value={form.diagnosis} onChange={set("diagnosis")} className="input-field text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "کد ICD-10" : "ICD-10 Code"}</label>
                {/* کد ICD همیشه ltr است: مثلاً E11.9 */}
                <input value={form.diagnosisCode} onChange={set("diagnosisCode")} className="input-field text-sm" dir="ltr" placeholder="e.g. E11.9" />
              </div>
            </div>

            {/* طرح درمان - textarea چند خطه */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "طرح درمان" : "Treatment Plan"}</label>
              <textarea value={form.treatmentPlan} onChange={set("treatmentPlan")} rows={3}
                className="input-field text-sm resize-none" />
            </div>

            {/* یادداشت پزشک */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "یادداشت پزشک" : "Doctor Notes"}</label>
              <textarea value={form.doctorNotes} onChange={set("doctorNotes")} rows={2}
                className="input-field text-sm resize-none" />
            </div>

            {/* دستورالعمل پیگیری */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "دستورالعمل پیگیری" : "Follow-up Instructions"}</label>
              <textarea value={form.followUpInstructions} onChange={set("followUpInstructions")} rows={2}
                className="input-field text-sm resize-none" />
            </div>

            {/* تاریخ ویزیت بعدی */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{lang === "fa" ? "تاریخ ویزیت بعدی" : "Next Visit Date"}</label>
              <input type="date" value={form.nextVisitDate} onChange={set("nextVisitDate")}
                className="input-field text-sm w-auto" dir="ltr" />
            </div>
          </div>

          {/* ─── دکمه‌های لغو/ذخیره ─────────────────────────── */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
