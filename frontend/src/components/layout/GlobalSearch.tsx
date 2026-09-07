// ══════════════════════════════════════════════════════════════
// GlobalSearch = جست‌وجوی سراسری (Ctrl+K / Cmd+K)
//
// چرا لازم بود؟
// قبلاً برای پیدا کردن یه بیمار وسط ویزیت، باید می‌رفتی صفحه‌ی
// «بیماران» و فیلتر می‌کردی — چند کلیک و یه صفحه‌ی کامل بارگذاری.
// این کامپوننت یه جعبه‌ی جست‌وجوی سریع می‌سازه که از هر صفحه‌ای
// با میانبر کیبورد یا دکمه‌ی هدر باز میشه و نتیجه رو فوری نشون میده.
//
// چی رو جست‌وجو می‌کنه؟
// - بیماران: مستقیم از API با پارامتر search (نام/تلفن/کد ملی)
// - نوبت‌ها: چون API نوبت‌ها فیلتر متنی نداره، یه دسته از نوبت‌های
//   اخیر رو می‌گیریم و سمت کلاینت بر اساس نام بیمار/دکتر فیلتر می‌کنیم
// ══════════════════════════════════════════════════════════════
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Calendar, X, CornerDownLeft } from "lucide-react";
import { patientApi, appointmentApi } from "@/lib/api/axios";
import { useAppStore } from "@/store/useStore";

interface PatientResult {
  id: string;
  fullName: string;
  phoneNumber: string;
}

interface AppointmentResult {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  status: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const { lang } = useAppStore();
  const fa = lang === "fa";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [appointments, setAppointments] = useState<AppointmentResult[]>([]);
  // کش نوبت‌های اخیر — فقط یه بار به‌ازای هر بار باز شدن مودال گرفته میشه، نه هر کلید فشرده
  const apptCacheRef = useRef<AppointmentResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const txt = {
    placeholder: fa ? "جست‌وجوی بیمار، نوبت..." : "Search patients, appointments...",
    patients: fa ? "بیماران" : "Patients",
    appointments: fa ? "نوبت‌ها" : "Appointments",
    noResults: fa ? "نتیجه‌ای یافت نشد" : "No results found",
    typeToSearch: fa ? "برای جست‌وجو تایپ کنید (حداقل ۲ حرف)" : "Type to search (min 2 characters)",
    openWith: fa ? "باز کردن جست‌وجو" : "Open search",
    select: fa ? "انتخاب" : "select",
    close: fa ? "بستن" : "close",
  };

  // ─── باز کردن با Ctrl+K / Cmd+K از هر جای برنامه ────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── وقتی باز میشه: فوکوس روی اینپوت + ریست کش نوبت‌ها ──────
  useEffect(() => {
    if (open) {
      setQuery("");
      setPatients([]);
      setAppointments([]);
      apptCacheRef.current = null;
      // یه فریم صبر کن تا مودال توی DOM باشه، بعد فوکوس بده
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ─── جست‌وجوی واقعی (debounce شده) ───────────────────────────
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setPatients([]);
      setAppointments([]);
      return;
    }
    setLoading(true);
    try {
      // بیماران: مستقیم از سرور با پارامتر search
      const patientsPromise = patientApi.getAll({ search: trimmed, page: 1, pageSize: 5 })
        .then(res => (res.data.items || []) as PatientResult[])
        .catch(() => [] as PatientResult[]);

      // نوبت‌ها: چون سرور فیلتر متنی نداره، یه بار ۵۰ تای اخیر رو کش می‌کنیم
      // و بعد سمت کلاینت روی نام بیمار/دکتر فیلتر می‌کنیم
      const apptListPromise = apptCacheRef.current
        ? Promise.resolve(apptCacheRef.current)
        : appointmentApi.getAll({ page: 1, pageSize: 50 })
            .then(res => {
              const items = (res.data.items || []) as AppointmentResult[];
              apptCacheRef.current = items;
              return items;
            })
            .catch(() => [] as AppointmentResult[]);

      const [pRes, aList] = await Promise.all([patientsPromise, apptListPromise]);
      setPatients(pRes);
      const needle = trimmed.toLowerCase();
      setAppointments(
        aList.filter(a =>
          a.patientName?.toLowerCase().includes(needle) ||
          a.doctorName?.toLowerCase().includes(needle)
        ).slice(0, 5)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── debounce ۳۰۰ میلی‌ثانیه‌ای روی تغییر query ──────────────
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const goToPatient = (id: string) => {
    setOpen(false);
    router.push(`/admin/patients/${id}`);
  };

  const hasQuery = query.trim().length >= 2;
  const hasResults = patients.length > 0 || appointments.length > 0;

  return (
    <>
      {/* دکمه‌ی هدر — روی موبایل فقط آیکون، روی دسکتاپ متن+میانبر هم نشون میده */}
      <button
        onClick={() => setOpen(true)}
        aria-label={txt.openWith}
        title={txt.openWith}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">{txt.placeholder}</span>
        <span className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-gray-400 border border-gray-200 rounded px-1 py-0.5 ms-2" dir="ltr">
          Ctrl+K
        </span>
      </button>

      {open && (
        // پس‌زمینه تار — کلیک روش مودال رو می‌بنده
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          {/* جعبه اصلی — کلیک داخلش نباید ببندتش */}
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            dir={fa ? "rtl" : "ltr"}
          >
            {/* نوار جست‌وجو */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={txt.placeholder}
                className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-400"
              />
              <button onClick={() => setOpen(false)} aria-label={txt.close} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* نتایج */}
            <div className="max-h-96 overflow-y-auto">
              {!hasQuery ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">{txt.typeToSearch}</div>
              ) : loading ? (
                <div className="p-3 space-y-2 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
                </div>
              ) : !hasResults ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">{txt.noResults}</div>
              ) : (
                <>
                  {patients.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1 text-xs font-semibold text-gray-400">{txt.patients}</div>
                      {patients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => goToPatient(p.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-start transition"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {p.fullName?.[0] || "؟"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{p.fullName}</div>
                            <div className="text-xs text-gray-400" dir="ltr">{p.phoneNumber}</div>
                          </div>
                          <Users className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {appointments.length > 0 && (
                    <div className="py-2 border-t border-gray-50">
                      <div className="px-4 py-1 text-xs font-semibold text-gray-400">{txt.appointments}</div>
                      {appointments.map(a => (
                        <button
                          key={a.id}
                          onClick={() => goToPatient(a.patientId)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-start transition"
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{a.patientName}</div>
                            <div className="text-xs text-gray-400 truncate">
                              {a.doctorName} · {new Date(a.appointmentDate).toLocaleDateString(fa ? "fa-IR" : "en-US")}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* پاورقی راهنما */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" /> {txt.select}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="border border-gray-200 rounded px-1">Esc</kbd> {txt.close}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
