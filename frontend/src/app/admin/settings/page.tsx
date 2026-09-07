// ══════════════════════════════════════════════════════════════
// صفحه تنظیمات (فقط دکتر/SuperAdmin می‌تونه ببینه)
//
// چهار تب داره:
// ۱. برنامه کاری هفتگی: دکتر تعیین می‌کنه کدام روزها و چه ساعت‌هایی کار می‌کنه
// ۲. روزهای تعطیل: مرخصی، تعطیلی‌های خاص
// ۳. پروفایل: ویرایش نام و اطلاعات دکتر
// ۴. اعلان‌ها: فعال/غیرفعال کردن SMS، تلگرام، واتساپ
// ══════════════════════════════════════════════════════════════
"use client";
import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { api, authApi } from "@/lib/api/axios";
import toast from "react-hot-toast";
import { Clock, CalendarOff, Plus, Trash2, Save, Bell, User } from "lucide-react";

// نام روزهای هفته فارسی و انگلیسی
const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const DAYS_EN = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// نقشه تبدیل index به DayOfWeek که سرور می‌فهمه
// شنبه در ایران = DayOfWeek.Saturday = 6 در .NET
// یکشنبه = Sunday = 0 در .NET
const DAY_OF_WEEK = [6, 0, 1, 2, 3, 4, 5];

// شکل هر ردیف برنامه کاری
interface ScheduleItem {
  dayIndex: number;    // ایندکس روز (۰=شنبه، ۶=جمعه)
  startTime: string;   // ساعت شروع (مثلاً "08:00")
  endTime: string;     // ساعت پایان (مثلاً "13:00")
  slotMinutes: number; // مدت هر نوبت به دقیقه (مثلاً ۳۰)
  active: boolean;     // آیا این روز کار می‌کنه؟
}

export default function SettingsPage() {
  const { lang } = useAppStore();
  const { user } = useAuthStore(); // اطلاعات کاربر لاگین‌کرده (دکتر)
  const t = useTranslations(lang);

  // تب فعال فعلی
  const [activeTab, setActiveTab] = useState<"schedule" | "daysoff" | "profile" | "notifications">("schedule");

  // ─── برنامه کاری هفتگی ────────────────────────────────────
  // پیش‌فرض: شنبه تا چهارشنبه ۸-۱۳، پنجشنبه ۸-۱۱ (غیرفعال)، جمعه تعطیل
  const [schedule, setSchedule] = useState<ScheduleItem[]>([
    { dayIndex: 0, startTime: "08:00", endTime: "13:00", slotMinutes: 30, active: true  }, // شنبه
    { dayIndex: 1, startTime: "08:00", endTime: "13:00", slotMinutes: 30, active: true  }, // یکشنبه
    { dayIndex: 2, startTime: "08:00", endTime: "13:00", slotMinutes: 30, active: true  }, // دوشنبه
    { dayIndex: 3, startTime: "08:00", endTime: "13:00", slotMinutes: 30, active: true  }, // سه‌شنبه
    { dayIndex: 4, startTime: "08:00", endTime: "13:00", slotMinutes: 30, active: true  }, // چهارشنبه
    { dayIndex: 5, startTime: "08:00", endTime: "11:00", slotMinutes: 30, active: false }, // پنجشنبه
    { dayIndex: 6, startTime: "00:00", endTime: "00:00", slotMinutes: 30, active: false }, // جمعه
  ]);

  // آیا در حال ذخیره برنامه کاری هستیم؟ (برای غیرفعال کردن دکمه)
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ─── روزهای تعطیل ────────────────────────────────────────
  // قبلاً یه نمونه‌ی الکی با تاریخ ۲۰۲۴ اینجا بود که همیشه
  // به کاربر نشون داده می‌شد. حالا واقعاً از سرور خونده و ذخیره میشه.
  const [daysOff, setDaysOff] = useState<{ id: string; date: string; reason: string }[]>([]);
  const [newDayOff, setNewDayOff] = useState({ date: "", reason: "" }); // فرم تعطیل جدید

  // ─── پروفایل و تنظیمات اعلان ─────────────────────────────
  // این‌ها از سرور خونده میشن و روی سرور هم ذخیره میشن
  const [profile, setProfile] = useState({ firstName: "", lastName: "", firstNameEn: "", lastNameEn: "" });
  const [notify, setNotify] = useState({ sms: false, telegram: false, whatsapp: false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);

  // ─── خوندن پروفایل فعلی از سرور ──────────────────────────
  // اسم کامل رو به نام و نام خانوادگی تقسیم می‌کنیم
  // (اولین کلمه = نام، بقیه = نام خانوادگی)
  const splitName = (full?: string) => {
    const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
  };

  useEffect(() => {
    authApi.getProfile()
      .then(({ data }) => {
        const fa = splitName(data.fullName);
        const en = splitName(data.fullNameEn);
        setProfile({ firstName: fa.first, lastName: fa.last, firstNameEn: en.first, lastNameEn: en.last });
        setNotify({
          sms: !!data.notifyViaSms,
          telegram: !!data.notifyViaTelegram,
          whatsapp: !!data.notifyViaWhatsApp,
        });
      })
      .catch(() => {
        // اگه سرور در دسترس نبود، حداقل اسم داخل توکن رو نشون بده
        const fa = splitName(user?.fullName);
        const en = splitName(user?.fullNameEn);
        setProfile({ firstName: fa.first, lastName: fa.last, firstNameEn: en.first, lastNameEn: en.last });
      });
  }, [user?.fullName, user?.fullNameEn]);

  // ─── خوندن برنامه کاری فعلی از سرور ──────────────────────
  // قبلاً این صفحه همیشه برنامه پیش‌فرض (شنبه تا چهارشنبه ۸-۱۳) رو
  // نشون می‌داد، حتی اگه دکتر قبلاً یه برنامه دیگه ذخیره کرده بود.
  // اگه سرور چیزی برگردونه، جایگزین پیش‌فرض میشه؛ وگرنه پیش‌فرض
  // به عنوان پیشنهاد اولیه (برای دکتری که هنوز چیزی ثبت نکرده) می‌مونه.
  const loadSchedule = async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get(`/workschedule/${user.id}`);
      if (!data || data.length === 0) return;
      setSchedule(prev => prev.map(item => {
        const found = data.find((s: any) => DAY_OF_WEEK[item.dayIndex] === s.dayOfWeek);
        return found
          ? { ...item, active: true, startTime: String(found.startTime).slice(0, 5), endTime: String(found.endTime).slice(0, 5), slotMinutes: found.slotDurationMinutes }
          : { ...item, active: false };
      }));
    } catch {
      // سرور در دسترس نبود؛ پیشنهاد پیش‌فرض همون‌طور می‌مونه
    }
  };

  // ─── خوندن روزهای تعطیل ثبت‌شده از سرور ──────────────────
  const loadDaysOff = async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get(`/workschedule/${user.id}/days-off`);
      setDaysOff((data || []).map((d: any) => ({ id: d.id, date: d.date, reason: d.reason || d.reasonEn || "" })));
    } catch {
      setDaysOff([]);
    }
  };

  useEffect(() => { loadSchedule(); loadDaysOff(); }, [user?.id]);

  // ─── ذخیره پروفایل روی سرور ──────────────────────────────
  // قبلاً این دکمه فقط یه پیام «ذخیره شد» نشون می‌داد و هیچی ذخیره نمی‌کرد
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await authApi.updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        firstNameEn: profile.firstNameEn,
        lastNameEn: profile.lastNameEn,
      });
      toast.success(lang === "fa" ? "پروفایل ذخیره شد" : "Profile saved");
    } catch {
      toast.error(lang === "fa" ? "ذخیره پروفایل ناموفق بود" : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── ذخیره تنظیمات اعلان روی سرور ────────────────────────
  // قبلاً این checkbox ها هیچ کاری نمی‌کردن
  const saveNotifications = async (next: typeof notify) => {
    const prev = notify;
    setNotify(next); // اول ظاهر رو عوض کن تا کاربر معطل نشه
    setSavingNotify(true);
    try {
      await authApi.updateProfile({
        notifyViaSms: next.sms,
        notifyViaTelegram: next.telegram,
        notifyViaWhatsApp: next.whatsapp,
      });
    } catch {
      setNotify(prev); // اگه ذخیره نشد، به حالت قبل برگرد
      toast.error(lang === "fa" ? "ذخیره تنظیمات اعلان ناموفق بود" : "Could not save notification settings");
    } finally {
      setSavingNotify(false);
    }
  };

  // ─── ذخیره برنامه کاری ───────────────────────────────────
  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      // فقط روزهایی که active هستن رو ارسال کن
      const active = schedule
        .filter(s => s.active)
        .map(s => ({
          dayOfWeek: DAY_OF_WEEK[s.dayIndex], // تبدیل index به DayOfWeek
          startTime: s.startTime + ":00",      // اضافه کردن ثانیه: "08:00" → "08:00:00"
          endTime: s.endTime + ":00",
          slotDurationMinutes: s.slotMinutes,
          maxPatientsPerSlot: 1, // یه بیمار در هر اسلات
        }));
      await api.post(`/workschedule/${user?.id}`, active);
      toast.success(lang === "fa" ? "برنامه کاری ذخیره شد" : "Schedule saved");
    } catch {
      // قبلاً اینجا پیام «ذخیره شد (demo)» نشون داده می‌شد؛
      // یعنی وقتی ذخیره شکست می‌خورد، به کاربر می‌گفتیم موفق بوده.
      // این خطرناکه: دکتر فکر می‌کنه ساعت کاریش ثبت شده ولی نشده.
      toast.error(lang === "fa" ? "ذخیره برنامه کاری ناموفق بود" : "Could not save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  // ─── اضافه کردن روز تعطیل (ذخیره واقعی روی سرور) ──────────
  const [savingDayOff, setSavingDayOff] = useState(false);
  const addDayOff = async () => {
    if (!newDayOff.date || !user?.id) return; // بدون تاریخ کاری نکن
    setSavingDayOff(true);
    try {
      await api.post(`/workschedule/${user.id}/days-off`, {
        date: newDayOff.date,
        reason: newDayOff.reason || null,
        reasonEn: null,
      });
      setNewDayOff({ date: "", reason: "" }); // فرم رو پاک کن
      toast.success(lang === "fa" ? "روز تعطیل اضافه شد" : "Day off added");
      await loadDaysOff(); // لیست رو با نسخه واقعی سرور (شامل id) به‌روز کن
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === "fa" ? "افزودن روز تعطیل ناموفق بود" : "Could not add day off"));
    } finally {
      setSavingDayOff(false);
    }
  };

  // ─── حذف روز تعطیل (از سرور هم پاک میشه) ──────────────────
  const removeDayOff = async (id: string) => {
    const prev = daysOff;
    setDaysOff(list => list.filter(d => d.id !== id)); // اول ظاهر رو عوض کن
    try {
      await api.delete(`/workschedule/days-off/${id}`);
    } catch {
      setDaysOff(prev); // اگه حذف نشد، برگردون
      toast.error(lang === "fa" ? "حذف روز تعطیل ناموفق بود" : "Could not remove day off");
    }
  };

  // ─── تعریف تب‌ها ─────────────────────────────────────────
  const tabs = [
    { id: "schedule",      label: lang === "fa" ? "برنامه کاری"  : "Work Schedule",       icon: <Clock       className="w-4 h-4" /> },
    { id: "daysoff",       label: lang === "fa" ? "روزهای تعطیل" : "Days Off",             icon: <CalendarOff className="w-4 h-4" /> },
    { id: "profile",       label: lang === "fa" ? "پروفایل"       : "Profile",              icon: <User        className="w-4 h-4" /> },
    { id: "notifications", label: lang === "fa" ? "اعلان‌ها"      : "Notifications",        icon: <Bell        className="w-4 h-4" /> },
  ] as const;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.nav.settings}</h1>

        {/* ─── تب‌ها ─────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"          // تب فعال: زیرخط آبی
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* ══════ تب ۱: برنامه کاری هفتگی ══════ */}
        {activeTab === "schedule" && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">
                {lang === "fa" ? "ساعت کار هفتگی" : "Weekly Work Hours"}
              </h3>
              <button onClick={saveSchedule} disabled={savingSchedule}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                <Save className="w-4 h-4" />
                {savingSchedule ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : t.common.save}
              </button>
            </div>

            <div className="space-y-3">
              {schedule.map((s, i) => (
                // کارت هر روز هفته - اگه active باشه آبی‌رنگ
                <div key={i} className={`rounded-xl p-4 border transition ${s.active ? "border-blue-200 bg-blue-50/40" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-center gap-4 flex-wrap">

                    {/* Toggle (کلید روشن/خاموش) */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.active}
                      aria-label={`${lang === "fa" ? DAYS_FA[i] : DAYS_EN[i]}`}
                      onClick={() => setSchedule(prev => prev.map((it, idx) => idx === i ? { ...it, active: !it.active } : it))}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${s.active ? "bg-blue-600" : "bg-gray-300"}`}>
                      {/* نقطه سفید داخل toggle */}
                      {/* start-0.5 یعنی از لبه‌ی «شروع» (راست در فارسی، چپ در انگلیسی) */}
                      {/* و rtl:-translate-x-5 یعنی در حالت راست‌به‌چپ برعکس حرکت کنه */}
                      <span className={`absolute top-0.5 start-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.active ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"}`} />
                    </button>

                    {/* نام روز */}
                    <span className={`w-20 text-sm font-medium flex-shrink-0 ${s.active ? "text-gray-900" : "text-gray-400"}`}>
                      {lang === "fa" ? DAYS_FA[i] : DAYS_EN[i]}
                    </span>

                    {/* فیلدهای ساعت - فقط اگه این روز فعال باشه */}
                    {s.active && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          {/* ساعت شروع */}
                          <input type="time" value={s.startTime} dir="ltr"
                            onChange={e => setSchedule(prev => prev.map((it, idx) => idx === i ? { ...it, startTime: e.target.value } : it))}
                            className="input-field w-auto text-sm py-1.5" />
                          <span className="text-gray-400">—</span>
                          {/* ساعت پایان */}
                          <input type="time" value={s.endTime} dir="ltr"
                            onChange={e => setSchedule(prev => prev.map((it, idx) => idx === i ? { ...it, endTime: e.target.value } : it))}
                            className="input-field w-auto text-sm py-1.5" />
                        </div>

                        {/* مدت هر نوبت */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 text-xs">{lang === "fa" ? "مدت نوبت (دقیقه):" : "Slot (min):"}</span>
                          <select value={s.slotMinutes} dir="ltr"
                            onChange={e => setSchedule(prev => prev.map((it, idx) => idx === i ? { ...it, slotMinutes: +e.target.value } : it))}
                            className="input-field w-auto text-sm py-1.5">
                            {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </>
                    )}

                    {/* اگه روز غیرفعال بود، فقط "تعطیل" نشون بده */}
                    {!s.active && (
                      <span className="text-xs text-gray-400">{lang === "fa" ? "تعطیل" : "Off"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ تب ۲: روزهای تعطیل ══════ */}
        {activeTab === "daysoff" && (
          <div className="card space-y-5">
            <h3 className="font-semibold text-gray-900">
              {lang === "fa" ? "تعریف روزهای تعطیل / مرخصی" : "Define Days Off / Leave"}
            </h3>

            {/* فرم اضافه کردن تعطیل جدید */}
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t.common.date}</label>
                <input type="date" value={newDayOff.date} dir="ltr"
                  onChange={e => setNewDayOff(d => ({ ...d, date: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-gray-500 mb-1 block">
                  {lang === "fa" ? "علت (اختیاری)" : "Reason (optional)"}
                </label>
                <input value={newDayOff.reason}
                  onChange={e => setNewDayOff(d => ({ ...d, reason: e.target.value }))}
                  className="input-field text-sm"
                  placeholder={lang === "fa" ? "مثال: مرخصی استعلاجی" : "e.g. Medical leave"} />
              </div>
              {/* دکمه افزودن - غیرفعال اگه تاریخ انتخاب نشده یا در حال ذخیره‌ست */}
              <button onClick={addDayOff} disabled={!newDayOff.date || savingDayOff}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50">
                <Plus className="w-4 h-4" />
                {savingDayOff ? (lang === "fa" ? "در حال افزودن..." : "Adding...") : (lang === "fa" ? "افزودن" : "Add")}
              </button>
            </div>

            {/* لیست روزهای تعطیل ثبت شده */}
            <div className="space-y-2 mt-2">
              {daysOff.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {lang === "fa" ? "روز تعطیلی ثبت نشده" : "No days off added"}
                </div>
              ) : daysOff.map((d) => (
                // هر تعطیل یه ردیف با پس‌زمینه قرمز کمرنگ
                <div key={d.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CalendarOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div>
                      {/* تاریخ به قالب "پنجشنبه، ۱۵ خرداد ۱۴۰۳" */}
                      <span className="font-medium text-gray-800 text-sm" dir="ltr">
                        {new Date(d.date).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </span>
                      {d.reason && <span className="text-xs text-gray-500 ms-2">— {d.reason}</span>}
                    </div>
                  </div>
                  {/* دکمه حذف */}
                  <button onClick={() => removeDayOff(d.id)}
                    className="text-gray-300 hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ تب ۳: پروفایل ══════ */}
        {activeTab === "profile" && (
          <div className="card max-w-lg space-y-5">
            <h3 className="font-semibold text-gray-900">{lang === "fa" ? "ویرایش پروفایل" : "Edit Profile"}</h3>
            {/* فیلدها کنترل‌شده هستن تا مقدارشون واقعاً ذخیره بشه */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">{lang === "fa" ? "نام (فارسی)" : "First Name (FA)"}</label>
                <input value={profile.firstName}
                  onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">{lang === "fa" ? "نام خانوادگی (فارسی)" : "Last Name (FA)"}</label>
                <input value={profile.lastName}
                  onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">{lang === "fa" ? "نام (انگلیسی)" : "First Name (EN)"}</label>
                <input value={profile.firstNameEn}
                  onChange={e => setProfile(p => ({ ...p, firstNameEn: e.target.value }))}
                  className="input-field text-sm" dir="ltr" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">{lang === "fa" ? "نام خانوادگی (انگلیسی)" : "Last Name (EN)"}</label>
                <input value={profile.lastNameEn}
                  onChange={e => setProfile(p => ({ ...p, lastNameEn: e.target.value }))}
                  className="input-field text-sm" dir="ltr" />
              </div>
            </div>
            <button onClick={saveProfile} disabled={savingProfile}
              className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" />
              {savingProfile ? (lang === "fa" ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        )}

        {/* ══════ تب ۴: تنظیمات اعلان‌ها ══════ */}
        {activeTab === "notifications" && (
          <div className="card max-w-lg space-y-5">
            <h3 className="font-semibold text-gray-900">
              {lang === "fa" ? "تنظیمات اعلان‌ها" : "Notification Settings"}
            </h3>
            {/* سه گزینه با checkbox — تغییرشون بلافاصله روی سرور ذخیره میشه */}
            {([
              {
                key: "sms" as const,
                label: lang === "fa" ? "ارسال SMS به بیماران" : "Send SMS to patients",
                sub: lang === "fa" ? "یادآور نوبت، تأیید و لغو" : "Appointment reminders, confirmations"
              },
              {
                key: "telegram" as const,
                label: lang === "fa" ? "ارسال پیام تلگرام" : "Send Telegram messages",
                sub: lang === "fa" ? "بیماران با تلگرام ایدی" : "Patients with Telegram ID"
              },
              {
                key: "whatsapp" as const,
                label: "WhatsApp",
                sub: lang === "fa" ? "از طریق Meta Cloud API" : "Via Meta Cloud API"
              },
            ]).map(({ key, label, sub }) => (
              // کارت گزینه - با کلیک روی کل کارت، checkbox تغییر می‌کنه
              <label key={key} className="flex items-start justify-between gap-4 cursor-pointer p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </div>
                {/* مقدار واقعی از سرور میاد و تغییرش هم ذخیره میشه */}
                <input
                  type="checkbox"
                  checked={notify[key]}
                  disabled={savingNotify}
                  onChange={e => saveNotifications({ ...notify, [key]: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-blue-600 disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
