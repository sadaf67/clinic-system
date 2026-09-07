// ══════════════════════════════════════════════════════════════
// BookAppointmentModal = مودال رزرو نوبت پزشکی
//
// این یه پنجره پاپ‌آپ (popup) سه مرحله‌ای هست:
//
// مرحله ۱: انتخاب تاریخ و نوع ویزیت (حضوری یا آنلاین)
// مرحله ۲: انتخاب ساعت از ساعت‌های خالی
// مرحله ۳: تأیید و ثبت نهایی (+ نوشتن علت مراجعه)
//
// مثل رزرو هتل:
// اول تاریخ → بعد ساعت → بعد تأیید و پرداخت
// ══════════════════════════════════════════════════════════════
"use client";
import { useEffect, useState } from "react";
import { appointmentApi, branchApi, doctorApi, patientApi } from "@/lib/api/axios";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import toast from "react-hot-toast";
import { X, Calendar, Clock, Video, User } from "lucide-react";

// ─── شکل یه اسلات زمانی (Slot) ──────────────────────────────
// هر اسلات یه بازه ۳۰ دقیقه‌ای است (یا هر مدتی که دکتر تعیین کرده)
interface Slot {
  startTime: string;    // ساعت شروع (مثلاً "09:00:00")
  endTime: string;      // ساعت پایان (مثلاً "09:30:00")
  isAvailable: boolean; // آیا خالی است؟ (true=خالی، false=پر)
}

// ─── پراپرتی‌های کامپوننت (ورودی‌ها از بیرون) ──────────────
interface Props {
  onClose: () => void;         // وقتی بسته میشه چه کاری کنه
  onBooked?: () => void;       // بعد از رزرو موفق چه کاری کنه
  defaultPatientId?: string;   // اگه بیمار از قبل مشخصه (از صفحه بیمار)
  defaultDoctorId?: string;    // اگه دکتر از قبل مشخصه
}

interface PersonOption {
  id: string;
  fullName: string;
  fullNameEn?: string;
}

interface BranchOption {
  id: string;
  name: string;
  isActive: boolean;
}

export default function BookAppointmentModal({ onClose, onBooked, defaultPatientId, defaultDoctorId }: Props) {
  const { lang } = useAppStore();
  const { user } = useAuthStore();
  const t = useTranslations(lang);
  const fa = lang === "fa"; // اگه فارسیه، fa = true

  // ─── State های مراحل ─────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);              // مرحله فعلی (۱، ۲، یا ۳)
  const [date, setDate] = useState("");                          // تاریخ انتخاب شده
  const [slots, setSlots] = useState<Slot[]>([]);               // لیست ساعت‌های خالی
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null); // ساعت انتخاب شده
  const [type, setType] = useState<"InPerson" | "Online">("InPerson"); // نوع ویزیت
  const [chiefComplaint, setChiefComplaint] = useState("");     // علت مراجعه
  const [loading, setLoading] = useState(false);                // آیا داریم ثبت می‌کنیم؟
  const [slotsLoading, setSlotsLoading] = useState(false);      // آیا ساعت‌ها دارن بارگذاری میشن؟
  const [patients, setPatients] = useState<PersonOption[]>([]);
  const [doctors, setDoctors] = useState<PersonOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [patientId, setPatientId] = useState(defaultPatientId || user?.patientId || "");
  const [doctorId, setDoctorId] = useState(
    defaultDoctorId || (user?.role === "SuperAdmin" ? user.id : "")
  );

  useEffect(() => {
    branchApi.getAll()
      .then(res => {
        const active = (res.data || []).filter((branch: BranchOption) => branch.isActive);
        setBranches(active);
        if (active.length === 1) setBranchId(active[0].id);
      })
      .catch(() => toast.error(fa ? "دریافت فهرست شعب ناموفق بود" : "Could not load branches"));
  }, [fa]);

  useEffect(() => {
    if (defaultDoctorId) return;
    doctorApi.getAll()
      .then(res => setDoctors(res.data || []))
      .catch(() => toast.error(fa ? "دریافت فهرست پزشکان ناموفق بود" : "Could not load doctors"));
  }, [defaultDoctorId, fa]);

  useEffect(() => {
    if (defaultPatientId || user?.role === "Patient") return;
    patientApi.getAll({ page: 1, pageSize: 100 })
      .then(res => setPatients(res.data?.items || []))
      .catch(() => toast.error(fa ? "دریافت فهرست بیماران ناموفق بود" : "Could not load patients"));
  }, [defaultPatientId, user?.role, fa]);

  // ─── بارگذاری ساعت‌های خالی هر بار که تاریخ عوض میشه ────
  // وقتی کاربر یه تاریخ انتخاب کرد، از سرور بپرس کدوم ساعت‌ها خالیه
  useEffect(() => {
    if (!date || !doctorId) return;
    setSlotsLoading(true);
    appointmentApi.getAvailableSlots(doctorId, date)
      .then(res => setSlots(res.data || []))   // ساعت‌های خالی رو ذخیره کن
      .catch(() => {
        setSlots([]);
        toast.error(fa ? "دریافت زمان‌های خالی ناموفق بود" : "Could not load available slots");
      })
      .finally(() => setSlotsLoading(false));
  }, [date, doctorId, fa]);

  // فقط ساعت و دقیقه رو از "09:00:00" بگیر → "09:00"
  const formatTime = (t: string) => t.slice(0, 5);

  // ─── ثبت نهایی نوبت ──────────────────────────────────────
  const book = async () => {
    if (!selectedSlot || !patientId || !doctorId || !branchId) {
      toast.error(fa ? "شعبه، پزشک، بیمار و زمان نوبت را انتخاب کنید" : "Select a branch, doctor, patient and time");
      return;
    }
    setLoading(true);
    try {
      // اطلاعات نوبت رو به سرور بفرست
      await appointmentApi.create({
        patientId,
        doctorId,
        branchId,
        appointmentDate: date,
        startTime: selectedSlot.startTime,
        type,                                   // InPerson یا Online
        chiefComplaint: chiefComplaint || null, // اختیاریه (اگه خالی بود null بفرست)
      });
      // پیام موفقیت
      toast.success(fa ? "نوبت با موفقیت رزرو شد ✓" : "Appointment booked successfully ✓");
      onBooked?.(); // اگه callback داشت، صداش بزن (مثلاً رفرش لیست)
      onClose();    // مودال رو ببند
    } catch (err: any) {
      // پیام خطا از سرور (مثلاً "این ساعت قبلاً رزرو شده")
      toast.error(err?.response?.data?.message || (fa ? "خطا در رزرو نوبت" : "Booking failed"));
    } finally {
      setLoading(false);
    }
  };

  // حداقل تاریخ قابل انتخاب = امروز (نمیشه نوبت برای دیروز گرفت)
  const minDate = new Date().toISOString().split("T")[0];

  return (
    // پس‌زمینه تیره (backdrop) پشت مودال
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* جعبه اصلی مودال */}
      {/* max-h + overflow-y-auto: مرحله ۱ (شعبه+بیمار+پزشک+تاریخ+نوع) روی موبایل ممکنه از ارتفاع صفحه بلندتر بشه؛ */}
      {/* بدون اسکرول، دکمه «ادامه» از دید خارج می‌شد و رزرو نوبت روی گوشی عملاً غیرممکن می‌شد */}
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto ${fa ? "rtl" : "ltr"}`} dir={fa ? "rtl" : "ltr"}>

        {/* ─── هدر مودال: عنوان + نشانگر مراحل + دکمه بستن ── */}
        {/* sticky = وقتی محتوای مرحله ۱ روی موبایل اسکرول می‌خوره، هدر و دکمه بستن همیشه در دسترس بمونن */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.appointment.bookAppointment}</h2>
            {/* نشانگر مراحل: ۳ خط که بزرگتر میشن وقتی هر مرحله رو رد می‌کنیم */}
            <div className="flex gap-1.5 mt-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${
                  step >= s ? "bg-blue-600 w-8" : "bg-gray-200 w-4"
                  // مرحله‌ای که گذشتیم: آبی و عریض | نگذشته: خاکستری و باریک
                }`} />
              ))}
            </div>
          </div>
          {/* دکمه × برای بستن مودال */}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ══════ مرحله ۱: انتخاب تاریخ + نوع ویزیت ══════ */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {fa ? "شعبه" : "Branch"} *
                </label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="input-field">
                  <option value="">{fa ? "انتخاب شعبه" : "Select branch"}</option>
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              {!defaultPatientId && user?.role !== "Patient" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {fa ? "بیمار" : "Patient"} *
                  </label>
                  <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input-field">
                    <option value="">{fa ? "انتخاب بیمار" : "Select patient"}</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {fa ? patient.fullName : patient.fullNameEn || patient.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!defaultDoctorId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {fa ? "پزشک" : "Doctor"} *
                  </label>
                  <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="input-field">
                    <option value="">{fa ? "انتخاب پزشک" : "Select doctor"}</option>
                    {doctors.map(doctor => (
                      <option key={doctor.id} value={doctor.id}>
                        {fa ? doctor.fullName : doctor.fullNameEn || doctor.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* انتخاب تاریخ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline me-1.5 text-blue-500" />
                  {t.appointment.date} *
                </label>
                {/* min=minDate یعنی قبل از امروز نمیشه انتخاب کرد */}
                <input type="date" min={minDate} value={date}
                  onChange={e => setDate(e.target.value)}
                  className="input-field" dir="ltr" />
              </div>

              {/* انتخاب نوع ویزیت */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.appointment.type}</label>
                {/* دو کارت: حضوری یا آنلاین */}
                <div className="grid grid-cols-2 gap-3">
                  {(["InPerson", "Online"] as const).map(tp => (
                    <button key={tp} type="button" onClick={() => setType(tp)}
                      className={`p-4 rounded-xl border-2 text-sm font-medium transition flex flex-col items-center gap-2 ${
                        type === tp
                          ? "border-blue-600 bg-blue-50 text-blue-700"   // انتخاب شده: آبی
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      {/* آیکون: ویدیو برای آنلاین، پروفایل برای حضوری */}
                      {tp === "Online" ? <Video className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      {tp === "Online" ? (fa ? "آنلاین" : "Online") : (fa ? "حضوری" : "In-Person")}
                    </button>
                  ))}
                </div>
              </div>

              {/* دکمه ادامه - اگه تاریخ انتخاب نشده غیرفعاله */}
              <button onClick={() => date && patientId && doctorId && branchId && setStep(2)} disabled={!date || !patientId || !doctorId || !branchId}
                className="btn-primary w-full py-3 disabled:opacity-50">
                {fa ? "انتخاب ساعت" : "Choose Time"}
              </button>
            </>
          )}

          {/* ══════ مرحله ۲: انتخاب ساعت ══════ */}
          {step === 2 && (
            <>
              {/* نمایش تاریخ انتخاب شده + دکمه تغییر */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-blue-500" />
                {/* تاریخ کامل: "شنبه، ۱۵ خرداد ۱۴۰۳" */}
                {new Date(date).toLocaleDateString(fa ? "fa-IR" : "en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                <button onClick={() => setStep(1)} className="ms-auto text-xs text-blue-600 hover:underline">
                  {fa ? "تغییر" : "Change"}
                </button>
              </div>

              {/* ساعت‌های خالی */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Clock className="w-4 h-4 inline me-1.5 text-blue-500" />
                  {t.appointment.availableSlots}
                </label>

                {slotsLoading ? (
                  // در حال بارگذاری: اسپینر
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  // گرید ساعت‌ها: ۳ تا در هر ردیف
                  // max-h-52 = حداکثر ارتفاع ۵۲ واحد - اگه بیشتر شد اسکرول بخوره
                  <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                    {slots.map((slot, i) => (
                      <button key={i} type="button"
                        disabled={!slot.isAvailable} // اگه پر بود، غیرفعال
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition border-2 ${
                          !slot.isAvailable
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" // پر → خاکستری
                            : selectedSlot?.startTime === slot.startTime
                            ? "border-blue-600 bg-blue-600 text-white"   // انتخاب شده → آبی پر
                            : "border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50" // خالی → سفید
                        }`} dir="ltr">
                        {formatTime(slot.startTime)} {/* نشون میده: "09:00" */}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* دکمه‌های قبلی / ادامه */}
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">{fa ? "قبلی" : "Back"}</button>
                <button onClick={() => selectedSlot && setStep(3)} disabled={!selectedSlot}
                  className="btn-primary flex-1 disabled:opacity-50">
                  {fa ? "ادامه" : "Continue"}
                </button>
              </div>
            </>
          )}

          {/* ══════ مرحله ۳: تأیید و ثبت نهایی ══════ */}
          {step === 3 && (
            <>
              {/* خلاصه اطلاعات نوبت - کارت آبی */}
              <div className="bg-blue-50 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t.appointment.date}</span>
                  {/* تاریخ کوتاه: "شنبه، ۱۵ خرداد" */}
                  <span className="font-medium" dir="ltr">
                    {new Date(date).toLocaleDateString(fa ? "fa-IR" : "en", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t.common.time}</span>
                  {/* ساعت انتخاب شده */}
                  <span className="font-medium tabular-nums" dir="ltr">{formatTime(selectedSlot!.startTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t.appointment.type}</span>
                  {/* نوع ویزیت با badge */}
                  <span className={`badge ${type === "Online" ? "badge-blue" : "badge-gray"}`}>
                    {type === "Online" ? (fa ? "آنلاین" : "Online") : (fa ? "حضوری" : "In-Person")}
                  </span>
                </div>
              </div>

              {/* فیلد علت مراجعه (اختیاری) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.appointment.chiefComplaint}</label>
                <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
                  rows={3} className="input-field text-sm resize-none"
                  placeholder={fa ? "علت مراجعه (اختیاری)..." : "Reason for visit (optional)..."} />
              </div>

              {/* اگه ویزیت آنلاین انتخاب شده: پیام اطلاع‌رسانی */}
              {type === "Online" && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
                  <Video className="w-3.5 h-3.5 inline me-1" />
                  {fa
                    ? "لینک جلسه آنلاین پس از تأیید نوبت از طریق SMS ارسال خواهد شد."
                    : "Online meeting link will be sent via SMS after confirmation."}
                </div>
              )}

              {/* دکمه‌های قبلی / رزرو نهایی */}
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">{fa ? "قبلی" : "Back"}</button>
                <button onClick={book} disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                  {/* اسپینر در حین ثبت */}
                  {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {fa ? "رزرو نوبت" : "Book Appointment"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
