// ══════════════════════════════════════════════════════════════
// صفحه پرونده کامل بیمار (Patient Detail)
//
// این صفحه همه اطلاعات یه بیمار رو نشون میده:
// آدرسش dynamic است: /admin/patients/[id] یعنی id از URL میاد
//
// پنج تب داره:
// ۱. اطلاعات کلی: سابقه پزشکی، اطلاعات تماس
// ۲. علائم حیاتی: نمودار وزن، فشار، قند و...
// ۳. پرونده‌های پزشکی: همه ویزیت‌های قبلی
// ۴. نسخه‌ها: داروهایی که تجویز شدن
// ۵. نوبت‌ها: تاریخچه و نوبت‌های آینده
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { patientApi, appointmentApi, medicalRecordApi, prescriptionApi, medicalFileApi } from "@/lib/api/axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"; // نمودار خطی
import {
  User, Calendar, FileText, Pill, Activity,
  Phone, MapPin, Heart, AlertCircle, ChevronLeft, ChevronDown,
  TrendingUp, TrendingDown, Minus, Plus, Edit2, History, Printer,
  Paperclip, Upload, Download, Trash2
} from "lucide-react";
import toast from "react-hot-toast";
import BookAppointmentModal from "@/components/forms/BookAppointmentModal";
import NewVisitModal from "@/components/forms/NewVisitModal";
import NewPrescriptionModal from "@/components/forms/NewPrescriptionModal";

// ─── رنگ هر نوع علامت حیاتی ──────────────────────────────────
// کلید = نوع (1=وزن، 2=فشار سیستولیک، ...)
const VITAL_COLORS: Record<number, string> = {
  1: "#3b82f6", // وزن: آبی
  2: "#ef4444", // فشار سیستولیک: قرمز
  3: "#f97316", // فشار دیاستولیک: نارنجی
  4: "#8b5cf6", // قند خون: بنفش
  5: "#ec4899", // ضربان قلب: صورتی
  6: "#f59e0b", // دما: زرد
  7: "#06b6d4", // اشباع اکسیژن: آبی روشن
  8: "#10b981", // BMI: سبز
};

// محدوده نرمال هر علامت حیاتی (برای خط راهنما روی نمودار)
const VITAL_NORMAL: Record<number, { min: number; max: number } | null> = {
  2: { min: 90,   max: 120  }, // فشار سیستولیک: ۹۰-۱۲۰ mmHg
  3: { min: 60,   max: 80   }, // فشار دیاستولیک: ۶۰-۸۰ mmHg
  4: { min: 70,   max: 140  }, // قند خون: ۷۰-۱۴۰ mg/dL
  5: { min: 60,   max: 100  }, // ضربان قلب: ۶۰-۱۰۰ bpm
  6: { min: 36.1, max: 37.2 }, // دما: ۳۶.۱-۳۷.۲ سانتیگراد
  7: { min: 95,   max: 100  }, // اشباع اکسیژن: ۹۵-۱۰۰ درصد
  1: null, // وزن: محدوده نرمال نداره (فردی است)
  8: null, // BMI: فردی است
};

// نوع‌های مجاز برای تب‌ها
type Tab = "overview" | "timeline" | "records" | "prescriptions" | "vitals" | "appointments";

// ─── یه رویداد در تایم‌لاین یکپارچه ────────────────────────────
// چرا این تب لازم بود؟
// قبلاً پرونده‌ها، نسخه‌ها و نوبت‌ها هر کدوم توی تب جدا بودن؛
// پزشک برای دیدن «چه اتفاقی برای این بیمار افتاد» باید بین سه تب می‌رفت.
// این تب همه رو روی یه خط زمانی واحد کنار هم می‌چینه.
interface TimelineEvent {
  key: string;
  date: string;                 // تاریخ ISO — برای مرتب‌سازی
  kind: "record" | "prescription" | "appointment";
  title: string;
  subtitle?: string;
  badge?: { text: string; className: string };
}

// ترجمه وضعیت نوبت‌ها به فارسی (هماهنگ با admin/appointments)
const APPT_STATUS_FA: Record<string, string> = {
  Pending: "در انتظار",
  Confirmed: "تأیید شده",
  Cancelled: "لغو شده",
  Completed: "انجام شده",
  NoShow: "غایب",
};

// نقشه ثابت کلاس‌های پس‌زمینه — چون Tailwind کلاس‌های داینامیک مثل
// `bg-${color}-50` رو در زمان build تشخیص نمی‌ده و کامپایل نمی‌کنه
const BG_COLOR_CLASS: Record<string, string> = {
  red: "bg-red-50",
  orange: "bg-orange-50",
  blue: "bg-blue-50",
  purple: "bg-purple-50",
};

export default function PatientDetailPage() {
  // id بیمار از URL میاد (مثلاً /admin/patients/abc-123 → id = "abc-123")
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useAppStore();
  const { user } = useAuthStore(); // برای درج نام پزشک روی برگه چاپ
  const t = useTranslations(lang);

  // State های صفحه
  const [patient, setPatient] = useState<any>(null);           // اطلاعات بیمار
  const [vitals, setVitals] = useState<any[]>([]);             // داده‌های علائم حیاتی
  const [records, setRecords] = useState<any[]>([]);           // پرونده‌های پزشکی
  const [prescriptions, setPrescriptions] = useState<any[]>([]); // نسخه‌ها
  const [appointments, setAppointments] = useState<any[]>([]); // نوبت‌ها
  const [tab, setTab] = useState<Tab>("overview");             // تب فعال
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);              // حالت ویرایش سابقه پزشکی
  const [editData, setEditData] = useState<any>({});          // داده‌های در حال ویرایش
  const [showBookModal, setShowBookModal] = useState(false);  // مودال نوبت جدید
  const [showNewVisit, setShowNewVisit] = useState(false);         // مودال ویزیت جدید
  const [showNewPrescription, setShowNewPrescription] = useState(false); // مودال نسخه جدید

  // ─── فایل‌های پیوست هر پرونده پزشکی (ماژول MedicalFiles) ────
  // بک‌اند فایل‌ها رو فقط توی جزئیات کامل هر پرونده برمی‌گردونه
  // (medicalRecordApi.getById)، نه توی لیست پرونده‌ها؛ پس با باز کردن
  // هر ردیف، جزئیاتش (و در نتیجه فایل‌هاش) رو تنبل (lazy) می‌گیریم
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<Record<string, any>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({});
  const [uploadingFile, setUploadingFile] = useState<Record<string, boolean>>({});
  const [fileDescription, setFileDescription] = useState<Record<string, string>>({});
  const [busyFile, setBusyFile] = useState<Record<string, boolean>>({});

  // ─── بارگذاری پرونده‌های پزشکی این بیمار (تب "پرونده‌های پزشکی") ──
  const loadRecords = () => {
    medicalRecordApi.getByPatient(id)
      .then(res => setRecords(res.data || []))
      .catch(() => setRecords([]));
  };

  // ─── بارگذاری نسخه‌های این بیمار (تب "نسخه‌ها") ──────────────
  const loadPrescriptions = () => {
    prescriptionApi.getByPatient(id)
      .then(res => setPrescriptions(res.data || []))
      .catch(() => setPrescriptions([]));
  };

  // ─── باز/بسته کردن ردیف یه پرونده پزشکی برای دیدن فایل‌های پیوستش ──
  const toggleRecordExpand = (recordId: string) => {
    const next = expandedRecordId === recordId ? null : recordId;
    setExpandedRecordId(next);
    if (next && !recordDetail[recordId]) {
      setLoadingDetail(prev => ({ ...prev, [recordId]: true }));
      medicalRecordApi.getById(recordId)
        .then(({ data }) => setRecordDetail(prev => ({ ...prev, [recordId]: data })))
        .catch(() => toast.error(lang === "fa" ? "دریافت جزئیات پرونده ناموفق بود" : "Could not load record details"))
        .finally(() => setLoadingDetail(prev => ({ ...prev, [recordId]: false })));
    }
  };

  // ─── بارگذاری مجدد جزئیات یه پرونده (بعد از آپلود/حذف فایل) ──
  const refreshRecordDetail = (recordId: string) => {
    medicalRecordApi.getById(recordId)
      .then(({ data }) => setRecordDetail(prev => ({ ...prev, [recordId]: data })))
      .catch(() => {});
  };

  // ─── آپلود فایل پیوست برای یه پرونده پزشکی ───────────────────
  const uploadFile = async (recordId: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === "fa" ? "حجم فایل نباید بیشتر از ۱۰ مگابایت باشد" : "File size must not exceed 10 MB");
      return;
    }
    setUploadingFile(prev => ({ ...prev, [recordId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("medicalRecordId", recordId);
      const desc = fileDescription[recordId]?.trim();
      if (desc) formData.append("description", desc);
      await medicalFileApi.upload(formData);
      toast.success(lang === "fa" ? "فایل بارگذاری شد" : "File uploaded");
      setFileDescription(prev => ({ ...prev, [recordId]: "" }));
      refreshRecordDetail(recordId);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "بارگذاری فایل ناموفق بود" : "Could not upload file"));
    } finally {
      setUploadingFile(prev => ({ ...prev, [recordId]: false }));
    }
  };

  // ─── دانلود فایل پیوست ────────────────────────────────────────
  const downloadFile = async (fileId: string, fileName: string) => {
    setBusyFile(prev => ({ ...prev, [fileId]: true }));
    try {
      const res = await medicalFileApi.download(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(lang === "fa" ? "دانلود فایل ناموفق بود" : "Could not download file");
    } finally {
      setBusyFile(prev => ({ ...prev, [fileId]: false }));
    }
  };

  // ─── حذف فایل پیوست (فقط پزشک/SuperAdmin) ────────────────────
  const deleteFile = async (fileId: string, recordId: string) => {
    if (!window.confirm(lang === "fa" ? "این فایل حذف شود؟" : "Delete this file?")) return;
    setBusyFile(prev => ({ ...prev, [fileId]: true }));
    try {
      await medicalFileApi.delete(fileId);
      toast.success(lang === "fa" ? "فایل حذف شد" : "File deleted");
      refreshRecordDetail(recordId);
    } catch {
      toast.error(lang === "fa" ? "حذف فایل ناموفق بود" : "Could not delete file");
    } finally {
      setBusyFile(prev => ({ ...prev, [fileId]: false }));
    }
  };

  // ─── بارگذاری اطلاعات بیمار ────────────────────────────────
  // Promise.all = پنج درخواست رو با هم بفرست، صبر کن همه تموم شن
  useEffect(() => {
    // اگه بارگذاری علائم حیاتی/پرونده‌ها/نسخه‌ها/نوبت‌ها خطا بخوره، نباید کل صفحه رو خراب کنه —
    // فقط همون بخش خالی می‌مونه؛ به همین خاطر هر کدوم fallback جدا داره
    Promise.all([
      patientApi.getById(id),        // اطلاعات کامل بیمار — اگه این خطا بخوره صفحه خطا نشون میده
      patientApi.getVitalTrends(id).catch(() => ({ data: [] })), // تاریخچه علائم حیاتی
      medicalRecordApi.getByPatient(id).catch(() => ({ data: [] })), // پرونده‌های پزشکی
      prescriptionApi.getByPatient(id).catch(() => ({ data: [] })),  // نسخه‌ها
      // API نوبت‌ها فیلتر بر اساس بیمار نداره، پس همه رو می‌گیریم و سمت کلاینت فیلتر می‌کنیم
      // (قبلاً این تب اصلاً پر نمی‌شد چون patient.appointments از سرور هیچ‌وقت برنمی‌گشت)
      appointmentApi.getAll({ page: 1, pageSize: 100 }).catch(() => ({ data: { items: [] } })),
    ]).then(([pRes, vRes, rRes, prRes, aRes]) => {
      setPatient(pRes.data);
      setVitals(vRes.data || []);
      setRecords(rRes.data || []);
      setPrescriptions(prRes.data || []);
      setAppointments((aRes.data.items || []).filter((a: any) => a.patientId === id));
      // مقادیر اولیه برای فرم ویرایش
      setEditData({
        allergies: pRes.data.allergies || "",
        chronicDiseases: pRes.data.chronicDiseases || "",
        currentMedications: pRes.data.currentMedications || "",
        familyHistory: pRes.data.familyHistory || "",
        address: pRes.data.address || "",
        insuranceProvider: pRes.data.insuranceProvider || "",
        insuranceCode: pRes.data.insuranceCode || "",
      });
    }).catch(() => {
      setPatient(null);
      setVitals([]);
      toast.error(lang === "fa" ? "دریافت پرونده بیمار ناموفق بود" : "Could not load patient record");
    }).finally(() => setLoading(false));
  }, [id]); // هر بار که id تغییر کرد، دوباره بارگذاری کن

  // ─── ذخیره تغییرات سابقه پزشکی ────────────────────────────
  const saveEdit = async () => {
    try {
      await patientApi.update(id, editData); // به سرور بفرست
      // در حافظه هم آپدیت کن (بدون reload)
      setPatient((p: any) => ({ ...p, ...editData }));
      setEditing(false);
      toast.success(lang === "fa" ? "اطلاعات ذخیره شد" : "Saved successfully");
    } catch {
      toast.error(lang === "fa" ? "خطا در ذخیره" : "Save failed");
    }
  };

  // ─── چاپ خلاصه کامل پرونده بیمار ───────────────────────────
  // همون الگوی چاپ نسخه (admin/prescriptions) رو اینجا هم به کار می‌بریم:
  // یه پنجره جدید و مستقل، نه window.print() روی کل صفحه (که منو و تب‌ها رو هم چاپ می‌کرد)
  const handlePrintRecord = () => {
    const fa = lang === "fa";
    const locale = fa ? "fa-IR" : "en-US";
    const fmt = (d: string) => (d ? new Date(d).toLocaleDateString(locale) : "—");
    const esc = (v: any) =>
      String(v ?? "").replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const win = window.open("", "_blank", "width=850,height=1100");
    if (!win) {
      toast.error(fa ? "برای چاپ، اجازه باز شدن پنجره را بدهید" : "Please allow pop-ups to print");
      return;
    }

    const genderLabel = patient.gender === 1 ? (fa ? "مرد" : "Male") : (fa ? "زن" : "Female");

    // ─── جدول سابقه پزشکی ──────────────────────────────────────
    const bgFields = [
      { label: fa ? "آلرژی‌ها" : "Allergies", value: patient.allergies },
      { label: fa ? "بیماری‌های مزمن" : "Chronic Diseases", value: patient.chronicDiseases },
      { label: fa ? "داروهای جاری" : "Current Medications", value: patient.currentMedications },
      { label: fa ? "سابقه خانوادگی" : "Family History", value: patient.familyHistory },
    ];
    const bgRows = bgFields.map(f => `
      <tr><td class="label">${esc(f.label)}</td><td>${esc(f.value) || "—"}</td></tr>`).join("");

    // ─── جدول آخرین علائم حیاتی ─────────────────────────────────
    const vitalRows = vitals.map((v: any) => {
      const last = v.dataPoints?.[v.dataPoints.length - 1]?.value;
      return `<tr><td>${esc(v.label)}</td><td>${esc(last)} ${esc(v.unit)}</td></tr>`;
    }).join("");

    // ─── جدول تاریخچه ویزیت‌ها ───────────────────────────────────
    const recordRows = records.map((r: any) => `
      <tr>
        <td>${fmt(r.visitDate)}</td>
        <td>${esc(r.diagnosis)}${r.diagnosisCode ? ` <span class="code">${esc(r.diagnosisCode)}</span>` : ""}</td>
        <td>${esc(r.chiefComplaint)}</td>
      </tr>`).join("");

    // ─── جدول نسخه‌ها ────────────────────────────────────────────
    const rxStatusFa: Record<string, string> = { Active: "فعال", Expired: "منقضی", Cancelled: "لغو" };
    const prescriptionRows = prescriptions.map((p: any) => `
      <tr>
        <td>${fmt(p.issuedDate)}</td>
        <td>${(p.items || []).map((it: any) => esc(it.medicineName)).join("، ")}</td>
        <td>${fa ? (rxStatusFa[p.status] ?? p.status) : p.status}</td>
      </tr>`).join("");

    // ─── جدول نوبت‌ها ────────────────────────────────────────────
    const apptRows = appointments.map((a: any) => `
      <tr>
        <td>${fmt(a.appointmentDate)} ${esc(a.startTime?.slice(0, 5))}</td>
        <td>${fa ? (APPT_STATUS_FA[a.status] ?? a.status) : a.status}</td>
        <td>${esc(a.chiefComplaint)}</td>
      </tr>`).join("");

    const section = (title: string, tableHead: string, rows: string, emptyText: string) => `
      <div class="section">
        <h2>${esc(title)}</h2>
        ${rows ? `<table>${tableHead}<tbody>${rows}</tbody></table>` : `<div class="empty">${esc(emptyText)}</div>`}
      </div>`;

    win.document.write(`<!DOCTYPE html>
<html lang="${fa ? "fa" : "en"}" dir="${fa ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${esc(patient.fullName)} — ${fa ? "پرونده کامل" : "Full Record"}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif; color: #111827; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  .head h1 { font-size: 18px; margin: 0 0 4px; }
  .head .sub { color: #4b5563; font-size: 11px; }
  .head .doc { text-align: ${fa ? "left" : "right"}; color: #4b5563; font-size: 11px; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; margin-bottom: 18px; }
  .meta div { font-size: 11px; color: #374151; }
  .meta span { color: #6b7280; }
  .section { margin-bottom: 18px; page-break-inside: avoid; }
  .section h2 { font-size: 13px; color: #1e3a8a; border-bottom: 1px solid #dbeafe; padding-bottom: 5px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: ${fa ? "right" : "left"}; vertical-align: top; }
  th { background: #f9fafb; font-size: 10.5px; color: #374151; }
  td.label { width: 130px; color: #6b7280; background: #f9fafb; font-size: 11px; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10px;
          background: #f3f4f6; border-radius: 4px; padding: 1px 5px; }
  .empty { color: #9ca3af; font-size: 11px; padding: 8px 0; }
  .sign { margin-top: 30px; display: flex; justify-content: flex-end; }
  .sign div { width: 180px; border-top: 1px dashed #9ca3af; padding-top: 6px;
              text-align: center; font-size: 11px; color: #4b5563; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${esc(patient.fullName)}</h1>
      <div class="sub">${fa ? "پرونده کامل پزشکی" : "Complete Medical Record"}</div>
    </div>
    <div class="doc">
      <div>${esc(fa ? user?.fullName : (user?.fullNameEn || user?.fullName)) || ""}</div>
      <div>${fmt(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="meta">
    <div><span>${fa ? "تلفن:" : "Phone:"}</span> ${esc(patient.phoneNumber)}</div>
    <div><span>${fa ? "کد ملی:" : "National ID:"}</span> ${esc(patient.nationalCode)}</div>
    <div><span>${fa ? "سن/جنسیت:" : "Age/Gender:"}</span> ${esc(patient.age)} — ${esc(genderLabel)}</div>
    <div><span>${fa ? "گروه خونی:" : "Blood Type:"}</span> ${esc(patient.bloodType) || "—"}</div>
    <div><span>${fa ? "بیمه:" : "Insurance:"}</span> ${esc(patient.insuranceProvider) || "—"}</div>
    <div><span>${fa ? "آدرس:" : "Address:"}</span> ${esc(patient.address) || "—"}</div>
  </div>

  ${section(fa ? "سابقه پزشکی" : "Medical Background", "", bgRows, "")}

  ${section(fa ? "آخرین علائم حیاتی" : "Latest Vitals",
    `<thead><tr><th>${fa ? "نوع" : "Type"}</th><th>${fa ? "مقدار" : "Value"}</th></tr></thead>`,
    vitalRows, fa ? "ثبت نشده" : "Not recorded")}

  ${section(fa ? "تاریخچه ویزیت‌ها" : "Visit History",
    `<thead><tr><th>${fa ? "تاریخ" : "Date"}</th><th>${fa ? "تشخیص" : "Diagnosis"}</th><th>${fa ? "علت مراجعه" : "Complaint"}</th></tr></thead>`,
    recordRows, fa ? "ویزیتی ثبت نشده" : "No visits recorded")}

  ${section(fa ? "نسخه‌ها" : "Prescriptions",
    `<thead><tr><th>${fa ? "تاریخ" : "Date"}</th><th>${fa ? "داروها" : "Medicines"}</th><th>${fa ? "وضعیت" : "Status"}</th></tr></thead>`,
    prescriptionRows, fa ? "نسخه‌ای ثبت نشده" : "No prescriptions recorded")}

  ${section(fa ? "نوبت‌ها" : "Appointments",
    `<thead><tr><th>${fa ? "تاریخ/ساعت" : "Date/Time"}</th><th>${fa ? "وضعیت" : "Status"}</th><th>${fa ? "علت مراجعه" : "Complaint"}</th></tr></thead>`,
    apptRows, fa ? "نوبتی ثبت نشده" : "No appointments recorded")}

  <div class="sign"><div>${fa ? "مهر و امضای پزشک" : "Doctor's signature & stamp"}</div></div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  // ─── تعریف تب‌ها ─────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",      label: lang === "fa" ? "اطلاعات کلی" : "Overview",    icon: <User      className="w-4 h-4" /> },
    { id: "timeline",      label: lang === "fa" ? "تایم‌لاین" : "Timeline",       icon: <History   className="w-4 h-4" /> },
    { id: "vitals",        label: t.patient.vitalSigns,                            icon: <Activity  className="w-4 h-4" /> },
    { id: "records",       label: t.nav.medicalRecords,                            icon: <FileText  className="w-4 h-4" /> },
    { id: "prescriptions", label: t.nav.prescriptions,                             icon: <Pill      className="w-4 h-4" /> },
    { id: "appointments",  label: t.nav.appointments,                              icon: <Calendar  className="w-4 h-4" /> },
  ];

  // ─── ساخت لیست تایم‌لاین از سه منبع داده (پرونده‌ها + نسخه‌ها + نوبت‌ها) ──
  // از پرانتزهای جدا (نه useMemo) استفاده می‌کنیم چون داده‌ها کوچیکن (چند ده رکورد
  // در سناریوی دمو) و ساده‌تره؛ هر بار رندر دوباره محاسبه میشه، مشکلی نیست
  const timelineEvents: TimelineEvent[] = [
    ...records.map((r: any): TimelineEvent => ({
      key: `record-${r.id}`,
      date: r.visitDate,
      kind: "record",
      title: r.diagnosis || (lang === "fa" ? "ویزیت پزشکی" : "Medical visit"),
      subtitle: r.chiefComplaint,
      badge: r.diagnosisCode ? { text: r.diagnosisCode, className: "badge-blue" } : undefined,
    })),
    ...prescriptions.map((p: any): TimelineEvent => ({
      key: `prescription-${p.id}`,
      date: p.issuedDate,
      kind: "prescription",
      title: lang === "fa" ? "نسخه پزشکی" : "Prescription",
      subtitle: (p.items || []).slice(0, 3).map((it: any) => it.medicineName).join("، "),
      badge: {
        text: lang === "fa"
          ? ({ Active: "فعال", Expired: "منقضی", Cancelled: "لغو" } as Record<string, string>)[p.status] ?? p.status
          : p.status,
        className: p.status === "Active" ? "badge-green" : p.status === "Expired" ? "badge-yellow" : "badge-red",
      },
    })),
    ...appointments.map((a: any): TimelineEvent => ({
      key: `appointment-${a.id}`,
      date: a.appointmentDate,
      kind: "appointment",
      title: lang === "fa" ? `نوبت — ساعت ${a.startTime?.slice(0, 5)}` : `Appointment — ${a.startTime?.slice(0, 5)}`,
      subtitle: a.chiefComplaint,
      badge: {
        text: lang === "fa" ? (APPT_STATUS_FA[a.status] ?? a.status) : a.status,
        className: a.status === "Confirmed" ? "badge-green" : a.status === "Cancelled" ? "badge-red" :
          a.status === "Completed" ? "badge-blue" : "badge-yellow",
      },
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // جدیدترین بالا

  // ظاهر هر نوع رویداد در تایم‌لاین (آیکون + رنگ)
  const TIMELINE_STYLE: Record<TimelineEvent["kind"], { icon: React.ReactNode; bg: string }> = {
    record:       { icon: <FileText className="w-4 h-4" />, bg: "bg-blue-500" },
    prescription: { icon: <Pill className="w-4 h-4" />,      bg: "bg-purple-500" },
    appointment:  { icon: <Calendar className="w-4 h-4" />,  bg: "bg-emerald-500" },
  };

  // ─── نمایش لودینگ ──────────────────────────────────────────
  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  if (!patient) return (
    <AdminLayout>
      <div className="text-center py-20 text-gray-400">{t.common.noData}</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── دکمه بازگشت ─────────────────────────────────────── */}
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
          <ChevronLeft className="w-4 h-4" />
          {lang === "fa" ? "بازگشت به لیست" : "Back to list"}
        </button>

        {/* ─── کارت اطلاعات اصلی بیمار ─────────────────────────── */}
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <div className="flex items-start gap-5">
            {/* آواتار بزرگ: حرف اول نام */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg flex-shrink-0">
              {patient.fullName?.[0] || "؟"}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{patient.fullName}</h1>
                  <p className="text-gray-500 mt-0.5" dir="ltr">{patient.phoneNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* گروه خونی با badge قرمز */}
                  {patient.bloodType && (
                    <span className="badge badge-red px-3 py-1 text-sm font-bold">{patient.bloodType}</span>
                  )}
                  {/* دکمه چاپ خلاصه کامل پرونده */}
                  <button
                    onClick={handlePrintRecord}
                    title={lang === "fa" ? "چاپ پرونده کامل" : "Print full record"}
                    className="btn-secondary flex items-center gap-1.5 text-sm">
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">{lang === "fa" ? "چاپ پرونده" : "Print Record"}</span>
                  </button>
                  {/* دکمه ثبت نوبت جدید */}
                  <button
                    onClick={() => setShowBookModal(true)}
                    className="btn-primary flex items-center gap-1.5 text-sm">
                    <Plus className="w-4 h-4" />
                    {t.appointment.new}
                  </button>
                </div>
              </div>

              {/* اطلاعات خلاصه: سن، جنسیت، تعداد ویزیت، بیمه */}
              <div className="flex flex-wrap gap-4 mt-3">
                {[
                  { icon: <User className="w-4 h-4" />, label: lang === "fa" ? `${patient.age} ساله` : `Age ${patient.age}` },
                  { icon: <Heart className="w-4 h-4" />, label: patient.gender === 1 ? (lang === "fa" ? "مرد" : "Male") : (lang === "fa" ? "زن" : "Female") },
                  { icon: <Calendar className="w-4 h-4" />, label: lang === "fa" ? `${patient.totalVisits} ویزیت` : `${patient.totalVisits} visits` },
                  ...(patient.insuranceProvider ? [{ icon: <AlertCircle className="w-4 h-4" />, label: patient.insuranceProvider }] : []),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="text-gray-400">{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── تب‌ها ─────────────────────────────────────────────── */}
        <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ══════ تب ۱: اطلاعات کلی ══════ */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* سابقه پزشکی با قابلیت ویرایش */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {lang === "fa" ? "سابقه پزشکی" : "Medical Background"}
                </h3>
                {/* دکمه ویرایش/لغو */}
                <button onClick={() => setEditing(!editing)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
                    editing ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  <Edit2 className="w-3.5 h-3.5" />
                  {editing ? (lang === "fa" ? "لغو" : "Cancel") : (lang === "fa" ? "ویرایش" : "Edit")}
                </button>
              </div>

              {/* چهار فیلد سابقه پزشکی */}
              {[
                { key: "allergies",         label: lang === "fa" ? "آلرژی‌ها"          : "Allergies",           color: "red" },
                { key: "chronicDiseases",   label: lang === "fa" ? "بیماری‌های مزمن"   : "Chronic Diseases",    color: "orange" },
                { key: "currentMedications",label: lang === "fa" ? "داروهای جاری"       : "Current Medications", color: "blue" },
                { key: "familyHistory",     label: lang === "fa" ? "سابقه خانوادگی"     : "Family History",      color: "purple" },
              ].map(field => (
                <div key={field.key} className="mb-4 last:mb-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {field.label}
                  </label>
                  {editing ? (
                    // حالت ویرایش: textarea قابل تغییر
                    <textarea
                      value={editData[field.key]}
                      onChange={e => setEditData((d: any) => ({ ...d, [field.key]: e.target.value }))}
                      rows={2}
                      className="input-field text-sm resize-none"
                    />
                  ) : (
                    // حالت نمایش: متن با پس‌زمینه رنگی
                    <p className={`text-sm text-gray-700 ${BG_COLOR_CLASS[field.color]} rounded-lg px-3 py-2 min-h-[36px]`}>
                      {patient[field.key] || <span className="text-gray-400">{lang === "fa" ? "ثبت نشده" : "Not recorded"}</span>}
                    </p>
                  )}
                </div>
              ))}

              {/* دکمه ذخیره - فقط در حالت ویرایش */}
              {editing && (
                <button onClick={saveEdit} className="btn-primary w-full mt-2">
                  {t.common.save}
                </button>
              )}
            </div>

            {/* ستون راست: تماس + علائم حیاتی خلاصه */}
            <div className="space-y-4">

              {/* اطلاعات تماس */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {lang === "fa" ? "اطلاعات تماس" : "Contact Info"}
                </h3>
                <div className="space-y-3">
                  {[
                    { icon: <Phone className="w-4 h-4" />, label: patient.phoneNumber, dir: "ltr" as const },
                    { icon: <MapPin className="w-4 h-4" />, label: patient.address || (lang === "fa" ? "ثبت نشده" : "Not recorded") },
                    {
                      // اضطراری: نام + شماره
                      icon: <AlertCircle className="w-4 h-4" />,
                      label: patient.emergencyContactName
                        ? `${patient.emergencyContactName} — ${patient.emergencyContactPhone}`
                        : (lang === "fa" ? "ثبت نشده" : "Not recorded")
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                      <span dir={item.dir}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* خلاصه آخرین علائم حیاتی (۴ تا) */}
              {vitals.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {lang === "fa" ? "آخرین علائم حیاتی" : "Latest Vitals"}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {vitals.slice(0, 4).map((v: any) => {
                      const last = v.dataPoints?.[v.dataPoints.length - 1]?.value; // آخرین مقدار
                      const normal = VITAL_NORMAL[v.type];
                      const ok = normal ? (last >= normal.min && last <= normal.max) : null; // آیا نرمال هست؟
                      return (
                        <div key={v.type} className="bg-gray-50 rounded-xl p-3">
                          <div className="text-xs text-gray-400 truncate">{v.label}</div>
                          <div className="font-bold text-gray-900 mt-0.5">
                            {last} <span className="text-xs font-normal text-gray-400">{v.unit}</span>
                          </div>
                          {ok !== null && (
                            // ✓ نرمال یا ⚠ غیر نرمال
                            <span className={`text-[10px] ${ok ? "text-green-600" : "text-red-600"}`}>
                              {ok ? "✓" : "⚠"} {ok ? (lang === "fa" ? "نرمال" : "Normal") : (lang === "fa" ? "غیر نرمال" : "Abnormal")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ تب تایم‌لاین: پرونده‌ها + نسخه‌ها + نوبت‌ها روی یک خط زمانی ══════ */}
        {tab === "timeline" && (
          <div className="card">
            {timelineEvents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {lang === "fa" ? "هنوز رویدادی برای این بیمار ثبت نشده" : "No events recorded for this patient yet"}
              </div>
            ) : (
              // خط عمودی سمت شروع (راست در RTL، چپ در LTR) که همه نقطه‌ها بهش وصل میشن
              <div className="relative ps-10">
                <div className="absolute top-1 bottom-1 start-4 w-px bg-gray-200" />
                <div className="space-y-6">
                  {timelineEvents.map(ev => {
                    const style = TIMELINE_STYLE[ev.kind];
                    return (
                      <div key={ev.key} className="relative">
                        {/* نقطه‌ی رنگی روی خط */}
                        <div className={`absolute -start-10 w-8 h-8 rounded-full ${style.bg} text-white flex items-center justify-center ring-4 ring-white shadow-sm`}>
                          {style.icon}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{ev.title}</div>
                            {ev.subtitle && <div className="text-sm text-gray-500 mt-0.5 truncate">{ev.subtitle}</div>}
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(ev.date).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", {
                                year: "numeric", month: "long", day: "numeric"
                              })}
                            </div>
                          </div>
                          {ev.badge && (
                            <span className={`badge ${ev.badge.className} flex-shrink-0`}>{ev.badge.text}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ تب ۲: نمودار علائم حیاتی ══════ */}
        {tab === "vitals" && (
          <div className="space-y-5">
            {vitals.length === 0 ? (
              <div className="card text-center py-16 text-gray-400">
                {lang === "fa" ? "داده‌ای ثبت نشده" : "No vital signs recorded"}
              </div>
            ) : vitals.map((v: any) => {
              const normal = VITAL_NORMAL[v.type];
              const last = v.dataPoints?.[v.dataPoints.length - 1]?.value;
              // آیکون روند: افزایشی / کاهشی / پایدار
              const TrendIcon = v.trendDirection === "up" ? TrendingUp : v.trendDirection === "down" ? TrendingDown : Minus;
              return (
                <div key={v.type} className="card">
                  {/* هدر هر نمودار */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* آیکون رنگی */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${VITAL_COLORS[v.type]}18` }}>
                        <Activity style={{ color: VITAL_COLORS[v.type] }} className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{v.label}</span>
                        <span className="text-sm text-gray-500 ms-2">{last} {v.unit}</span>
                        {/* badge نرمال / خارج از محدوده */}
                        {normal && (
                          <span className={`ms-2 badge text-[10px] ${last >= normal.min && last <= normal.max ? "badge-green" : "badge-red"}`}>
                            {last >= normal.min && last <= normal.max
                              ? (lang === "fa" ? "نرمال" : "Normal")
                              : (lang === "fa" ? "خارج از محدوده" : "Out of range")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* نشانگر روند */}
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <TrendIcon className={`w-4 h-4 ${
                        v.trendDirection === "up" ? "text-red-500" :
                        v.trendDirection === "down" ? "text-blue-500" : "text-green-500"
                      }`} />
                      <span>{lang === "fa" ? ({ up: "افزایشی", down: "کاهشی", stable: "پایدار" } as any)[v.trendDirection] : v.trendDirection}</span>
                    </div>
                  </div>

                  {/* نمودار خطی */}
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={v.dataPoints?.map((d: any) => ({
                      ...d,
                      date: new Date(d.date).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", { month: "short", day: "numeric" })
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "var(--font-vazir)" }} />
                      <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} width={35} />
                      <Tooltip
                        contentStyle={{ fontFamily: "var(--font-vazir)", borderRadius: "10px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}
                        formatter={(val: number) => [`${val} ${v.unit}`, v.label]}
                      />
                      {/* خطوط سبز نشانگر محدوده نرمال */}
                      {normal && <>
                        <ReferenceLine y={normal.max} stroke="#22c55e" strokeDasharray="3 3" />
                        <ReferenceLine y={normal.min} stroke="#22c55e" strokeDasharray="3 3" />
                      </>}
                      {/* خط اصلی داده‌ها */}
                      <Line type="monotone" dataKey="value" stroke={VITAL_COLORS[v.type]}
                        strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════ تب ۳: پرونده‌های پزشکی ══════ */}
        {tab === "records" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t.nav.medicalRecords}</h2>
              <button onClick={() => setShowNewVisit(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus className="w-4 h-4" />
                {lang === "fa" ? "ثبت ویزیت جدید" : "New Visit"}
              </button>
            </div>

            {records.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "پرونده‌ای ثبت نشده" : "No records yet"}
              </div>
            ) : records.map(r => {
              const isExpanded = expandedRecordId === r.id;
              const detail = recordDetail[r.id];
              const files: any[] = detail?.files || [];
              return (
              // کارت هر ویزیت با یه خط آبی سمت چپ — قابل باز/بسته شدن برای دیدن فایل‌های پیوست
              <div key={r.id} className="card border-s-4 border-blue-400 !p-0">
                <button
                  type="button"
                  onClick={() => toggleRecordExpand(r.id)}
                  className="w-full text-start p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">
                      {new Date(r.visitDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-blue">{r.diagnosisCode}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{r.chiefComplaint}</p>
                  <p className="text-sm text-blue-700 font-medium mt-1">{r.diagnosis}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {r.weight && <span>{lang === "fa" ? "وزن:" : "Wt:"} {r.weight}kg</span>}
                    {r.bloodPressureSystolic && <span>BP: {r.bloodPressureSystolic}/{r.bloodPressureDiastolic}</span>}
                    {r.heartRate && <span>HR: {r.heartRate}</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <Paperclip className="w-4 h-4" />
                      {t.medicalFile.title}
                    </div>

                    {loadingDetail[r.id] ? (
                      <div className="text-sm text-gray-400 py-4 text-center">
                        {lang === "fa" ? "در حال بارگذاری..." : "Loading..."}
                      </div>
                    ) : (
                      <>
                        {files.length === 0 ? (
                          <div className="text-sm text-gray-400 py-2">{t.medicalFile.noFiles}</div>
                        ) : (
                          <div className="space-y-1.5">
                            {files.map((f: any) => (
                              <div key={f.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800 truncate">{f.fileName}</div>
                                  {f.description && <div className="text-xs text-gray-500 truncate">{f.description}</div>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={!!busyFile[f.id]}
                                    onClick={() => downloadFile(f.id, f.fileName)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                                    title={t.medicalFile.download}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {user?.role === "SuperAdmin" && (
                                    <button
                                      type="button"
                                      disabled={!!busyFile[f.id]}
                                      onClick={() => deleteFile(f.id, r.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                      title={t.medicalFile.delete}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="text"
                            value={fileDescription[r.id] || ""}
                            onChange={(e) => setFileDescription(prev => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder={t.medicalFile.description}
                            className="input-field flex-1 text-sm"
                          />
                          <label className={`btn-secondary flex items-center gap-1.5 text-sm cursor-pointer ${uploadingFile[r.id] ? "opacity-50 pointer-events-none" : ""}`}>
                            <Upload className="w-4 h-4" />
                            {uploadingFile[r.id] ? t.medicalFile.uploading : t.medicalFile.upload}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadFile(r.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-gray-400">{t.medicalFile.allowedTypes}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* ══════ تب ۴: نسخه‌ها ══════ */}
        {tab === "prescriptions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t.nav.prescriptions}</h2>
              <button onClick={() => setShowNewPrescription(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus className="w-4 h-4" />
                {t.prescription.new}
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "نسخه‌ای ثبت نشده" : "No prescriptions yet"}
              </div>
            ) : prescriptions.map((p: any) => (
              // کارت هر نسخه — با یه خط بنفش سمت چپ (هماهنگ با کارت‌های تب پرونده‌ها)
              <div key={p.id} className="card border-s-4 border-purple-400">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {new Date(p.issuedDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                  </div>
                  <span className={`badge ${p.status === "Active" ? "badge-green" : p.status === "Expired" ? "badge-yellow" : "badge-red"}`}>
                    {lang === "fa"
                      ? ({ Active: "فعال", Expired: "منقضی", Cancelled: "لغو" } as Record<string, string>)[p.status] ?? p.status
                      : p.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(p.items || []).slice(0, 3).map((item: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded-lg px-2.5 py-1">
                      {item.medicineName} · {item.dosage} · {item.frequency}
                    </span>
                  ))}
                  {p.items?.length > 3 && (
                    <span className="text-xs text-gray-400">+{p.items.length - 3} {lang === "fa" ? "بیشتر" : "more"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════ تب ۵: نوبت‌ها ══════ */}
        {tab === "appointments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{t.nav.appointments}</h2>
              <button onClick={() => setShowBookModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus className="w-4 h-4" />
                {t.appointment.new}
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                {lang === "fa" ? "نوبتی ثبت نشده" : "No appointments yet"}
              </div>
            ) : appointments.map((a: any) => (
              <div key={a.id} className="card flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  {/* تاریخ و ساعت */}
                  <div className="font-medium text-gray-900">
                    {new Date(a.appointmentDate).toLocaleDateString(lang === "fa" ? "fa-IR" : "en")}
                    {" — "}
                    <span dir="ltr">{a.startTime?.slice(0, 5)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.chiefComplaint || "—"}</div>
                </div>
                {/* وضعیت با رنگ مناسب */}
                <span className={`badge ${
                  a.status === "Confirmed" ? "badge-green" :
                  a.status === "Cancelled" ? "badge-red" :
                  a.status === "Completed" ? "badge-blue" : "badge-yellow"
                }`}>{lang === "fa" ? (APPT_STATUS_FA[a.status] ?? a.status) : a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── مودال ثبت نوبت جدید برای این بیمار ─────────────── */}
      {showBookModal && (
        <BookAppointmentModal
          defaultPatientId={id} // بیمار از پیش انتخاب شده
          onClose={() => setShowBookModal(false)}
          onBooked={() => {
            setShowBookModal(false);
            // رفرش لیست نوبت‌های بیمار
            appointmentApi.getAll({ page: 1, pageSize: 100 })
              .then(res => {
                const patientAppts = (res.data.items || []).filter((a: any) => a.patientId === id);
                setAppointments(patientAppts);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* ─── مودال ثبت ویزیت جدید برای این بیمار ─────────────── */}
      {showNewVisit && (
        <NewVisitModal
          lang={lang}
          t={t}
          defaultPatientId={id}
          onClose={() => setShowNewVisit(false)}
          onSaved={loadRecords}
        />
      )}

      {/* ─── مودال صدور نسخه جدید برای این بیمار ─────────────── */}
      {showNewPrescription && (
        <NewPrescriptionModal
          lang={lang}
          t={t}
          defaultPatientId={id}
          onClose={() => setShowNewPrescription(false)}
          onSaved={loadPrescriptions}
        />
      )}
    </AdminLayout>
  );
}
