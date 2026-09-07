// ══════════════════════════════════════════════════════════════
// AdminLayout = قالب کلی پنل مدیریت
//
// این فایل "ساختار" صفحات مدیریتی رو میسازه:
// - یه نوار کناری (Sidebar) سمت چپ یا راست که لینک‌های منو توشه
// - یه هدر (نوار بالا) با عنوان صفحه، دکمه زبان و اعلان‌ها
// - یه بخش اصلی (Main) که محتوای هر صفحه اونجا نشون داده میشه
//
// هر صفحه مدیریتی (مثلاً لیست بیماران، داشبورد) از این قالب استفاده می‌کنه
// مثل: وقتی میری داشبورد، داشبورد "داخل" این AdminLayout قرار می‌گیره
//
// رفتار روی موبایل با دسکتاپ فرق می‌کنه:
// - دسکتاپ: منو یه ستون ثابته که می‌تونه جمع بشه (فقط آیکون)
// - موبایل: منو یه کشوی روییه که از کنار میاد بیرون و پشتش تار میشه
// ══════════════════════════════════════════════════════════════
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, useAppStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { useAuthHydrated } from "@/lib/hooks/useHydrated";
import { useNotificationHub, NotificationPayload } from "@/lib/hooks/useSignalR";
import { notificationApi } from "@/lib/api/axios";
import Link from "next/link";
import toast from "react-hot-toast";
import GlobalSearch from "./GlobalSearch";
import {
  LayoutDashboard, Users, Calendar, FileText, Pill,
  MessageSquare, BarChart3, Settings, Bell, LogOut,
  Menu, X, Globe, Stethoscope, PanelLeftClose, PanelLeftOpen, ShieldCheck, History,
  Sun, Moon, ClipboardList, Receipt, Package
} from "lucide-react";

// ─── تعریف شکل هر آیتم منو ───────────────────────────────────
// NavItem = یه دکمه توی منوی کناری
// هر دکمه: آدرس صفحه، آیکون، متن، و اختیاری: کدام نقش‌ها می‌بیننش
interface NavItem {
  href: string;          // آدرس صفحه (مثلاً /admin/patients)
  icon: React.ReactNode; // آیکون کنار متن (مثلاً آیکون تقویم)
  label: string;         // متن دکمه (مثلاً "نوبت‌ها")
  roles?: string[];      // اگه فقط دکتر یا منشی باید ببینه، اینجا مشخص می‌کنیم
}

// ─── شکل یه اعلان که از سرور میاد ───────────────────────────
interface NotificationItem {
  id: string;
  title: string;      // عنوان فارسی
  titleEn: string;    // عنوان انگلیسی
  message: string;    // متن فارسی
  messageEn: string;  // متن انگلیسی
  isRead: boolean;    // خونده شده یا نه
  createdAt: string;  // زمان ساخت
}

// ─── کامپوننت اصلی AdminLayout ───────────────────────────────
// children = محتوایی که داخل این قالب قرار می‌گیره
// مثلاً: <AdminLayout><DashboardPage /></AdminLayout>
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();        // برای هدایت کاربر به صفحه دیگه
  const pathname = usePathname();    // آدرس صفحه فعلی (تا بفهمیم کدوم دکمه منو "فعال" هست)

  // اطلاعات کاربر لاگین‌کرده از حافظه مرکزی
  const { user, logout, isAuthenticated } = useAuthStore();

  // تنظیمات ظاهری از حافظه مرکزی (sidebarOpen فقط برای دسکتاپه)
  const { lang, setLang, sidebarOpen, toggleSidebar, theme, toggleTheme } = useAppStore();

  const t = useTranslations(lang); // متن‌های زبان انتخاب شده

  // آیا اطلاعات لاگین از localStorage خونده شده؟
  // تا وقتی نخونده، نباید کاربر رو به صفحه ورود بفرستیم
  const hydrated = useAuthHydrated();

  // کشوی منو روی موبایل — جدا از حالت دسکتاپ نگه داشته میشه
  const [drawerOpen, setDrawerOpen] = useState(false);

  // اعلان‌ها
  const [notifCount, setNotifCount] = useState(0);            // تعداد خوانده‌نشده‌ها
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]); // لیست اعلان‌ها
  const [notifOpen, setNotifOpen] = useState(false);          // آیا لیست بازه؟
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);              // برای تشخیص کلیک بیرون

  // ─── اعلان‌های لحظه‌ای از طریق SignalR ─────────────────────
  // وقتی سرور یه اعلان جدید بفرسته (نوبت جدید، پاسخ مشاوره و...)
  // بدون نیاز به رفرش یا صبر کردن برای polling دوره‌ای، همون لحظه:
  // ۱. تعداد خوانده‌نشده‌ها رو یکی زیاد می‌کنه
  // ۲. به بالای لیست کشویی اعلان‌ها اضافه می‌کنه
  // ۳. یه toast کوچیک نشون میده تا حتی بدون باز کردن زنگ هم بفهمه
  const handleRealtimeNotification = (n: NotificationPayload) => {
    setNotifCount(c => c + 1);
    setNotifItems(prev => [
      { id: n.id, title: n.title, titleEn: n.titleEn, message: n.message, messageEn: n.messageEn, isRead: n.isRead, createdAt: n.createdAt },
      ...prev,
    ].slice(0, 8));
    toast(lang === "fa" ? (n.title || "اعلان جدید") : (n.titleEn || n.title || "New notification"), { icon: "🔔" });
  };
  useNotificationHub(handleRealtimeNotification);

  // ─── بررسی وضعیت لاگین ──────────────────────────────────────
  // اگه لاگین نبود → برو صفحه ورود (حفاظت از صفحات مدیریتی)
  // شرط hydrated خیلی مهمه: بدون اون، با هر Refresh کاربرِ
  // لاگین‌کرده هم یه لحظه «لاگین‌نکرده» حساب می‌شد و پرت می‌شد بیرون
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.push("/login");
    else if (user?.role === "Patient") router.push("/portal");
  }, [hydrated, isAuthenticated, user?.role, router]);

  // ─── گرفتن تعداد اعلان‌های خوانده‌نشده ─────────────────────
  // بعد از هر تغییر صفحه دوباره چک می‌کنه
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    notificationApi.getAll({ page: 1, pageSize: 1 })
      .then(({ data }) => setNotifCount(data.unreadCount ?? 0))
      .catch(() => setNotifCount(0));
  }, [hydrated, isAuthenticated, pathname]);

  // ─── با عوض شدن صفحه، کشوی موبایل و لیست اعلان بسته بشه ───
  // بدون این، بعد از کلیک روی یه لینک منو، کشو باز می‌موند
  useEffect(() => {
    setDrawerOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // ─── بستن لیست اعلان با کلیک بیرون یا زدن Escape ──────────
  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNotifOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  // ─── باز کردن لیست اعلان‌ها (و گرفتن آخرین‌ها از سرور) ────
  const openNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (!next) return;             // اگه داریم می‌بندیم، لازم نیست چیزی بگیریم
    setNotifLoading(true);
    try {
      const { data } = await notificationApi.getAll({ page: 1, pageSize: 8 });
      setNotifItems(data.items ?? []);
      setNotifCount(data.unreadCount ?? 0);
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  };

  // ─── خوانده‌شده کردن همه اعلان‌ها ────────────────────────
  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifItems(items => items.map(n => ({ ...n, isRead: true })));
      setNotifCount(0);
    } catch {
      /* اگه سرور در دسترس نبود، بی‌سروصدا رد شو */
    }
  };

  // ─── لیست آیتم‌های منوی کناری ──────────────────────────────
  // هر آیتم یه لینک به یه صفحه است
  // roles: اگه نداشت = همه می‌بینن | اگه داشت = فقط اون نقش‌ها
  const navItems: NavItem[] = [
    {
      href: "/admin/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: t.nav.dashboard  // داشبورد - همه می‌بینن
    },
    {
      href: "/admin/patients",
      icon: <Users className="w-5 h-5" />,
      label: t.nav.patients,
      roles: ["SuperAdmin", "Admin"] // لیست بیماران - فقط دکتر و منشی
    },
    {
      href: "/admin/appointments",
      icon: <Calendar className="w-5 h-5" />,
      label: t.nav.appointments  // نوبت‌ها - همه می‌بینن
    },
    {
      href: "/admin/medical-records",
      icon: <FileText className="w-5 h-5" />,
      label: t.nav.medicalRecords  // پرونده‌های پزشکی
    },
    {
      href: "/admin/prescriptions",
      icon: <Pill className="w-5 h-5" />,
      label: t.nav.prescriptions  // نسخه‌ها
    },
    {
      href: "/admin/consultations",
      icon: <MessageSquare className="w-5 h-5" />,
      label: t.nav.consultations
    },
    {
      href: "/admin/visit-queue",
      icon: <ClipboardList className="w-5 h-5" />,
      label: t.nav.visitQueue,
      roles: ["SuperAdmin", "Admin"] // صف پذیرش حضوری - فقط دکتر و منشی، هم‌راستا با محدودیت بک‌اند
    },
    {
      href: "/admin/billing",
      icon: <Receipt className="w-5 h-5" />,
      label: t.nav.billing,
      roles: ["SuperAdmin", "Admin"] // فاکتورها - فقط دکتر و منشی (بیمار از پرتال خودش می‌بینه)
    },
    {
      href: "/admin/inventory",
      icon: <Package className="w-5 h-5" />,
      label: t.nav.inventory,
      roles: ["SuperAdmin", "Admin"] // انبار - فقط دکتر و منشی، هم‌راستا با محدودیت بک‌اند
    },
    {
      href: "/admin/reports",
      icon: <BarChart3 className="w-5 h-5" />,
      label: t.nav.reports  // گزارش‌ها
    },
    {
      href: "/admin/users",
      icon: <ShieldCheck className="w-5 h-5" />,
      label: t.nav.users,
      roles: ["SuperAdmin"] // مدیریت کاربران - فقط دکتر
    },
    {
      href: "/admin/audit",
      icon: <History className="w-5 h-5" />,
      label: t.nav.auditLog,
      roles: ["SuperAdmin"] // لاگ فعالیت - فقط دکتر (SuperAdmin)، هم‌راستا با محدودیت بک‌اند
    },
    {
      href: "/admin/settings",
      icon: <Settings className="w-5 h-5" />,
      label: t.nav.settings,
      roles: ["SuperAdmin"] // تنظیمات - فقط دکتر (SuperAdmin) می‌بینه
    },
  ];

  // ─── فیلتر کردن منو بر اساس نقش ────────────────────────────
  // اگه آیتمی roles نداشت → همه ببینن
  // اگه داشت → چک کن آیا نقش کاربر فعلی توی اون لیست هست
  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user?.role ?? "")
  );

  // ─── عنوان صفحه فعلی برای هدر ──────────────────────────────
  // طولانی‌ترین آدرسی که با مسیر فعلی جور در میاد رو پیدا می‌کنه
  // (تا /admin/patients/123 هم عنوان "بیماران" بگیره)
  const currentTitle = navItems
    .filter(i => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "";

  // ─── تابع خروج از سیستم ─────────────────────────────────────
  // توکن رو پاک می‌کنه + کاربر رو به صفحه لاگین می‌بره
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // برچسب نقش کاربر به زبان فعلی
  const roleLabel =
    user?.role === "SuperAdmin" ? (lang === "fa" ? "پزشک" : "Doctor") :
    user?.role === "Admin" ? (lang === "fa" ? "منشی" : "Admin") :
    (lang === "fa" ? "بیمار" : "Patient");

  // متن‌های کوتاهی که هم فارسی هم انگلیسی لازم داریم
  const txt = {
    openMenu:   lang === "fa" ? "باز کردن منو" : "Open menu",
    closeMenu:  lang === "fa" ? "بستن منو" : "Close menu",
    collapse:   lang === "fa" ? "جمع کردن منو" : "Collapse sidebar",
    expand:     lang === "fa" ? "باز کردن منو" : "Expand sidebar",
    switchLang: lang === "fa" ? "Switch to English" : "تغییر به فارسی",
    switchTheme: theme === "dark" ? (lang === "fa" ? "حالت روشن" : "Light mode") : (lang === "fa" ? "حالت تاریک" : "Dark mode"),
  };

  // وقتی منو روی دسکتاپ جمع شده، متن‌ها رو مخفی کن
  // (ولی توی کشوی موبایل همیشه متن‌ها دیده میشن)
  const labelHidden = sidebarOpen ? "" : "lg:hidden";

  // ─── صفحه انتظار تا وقتی وضعیت لاگین مشخص بشه ─────────────
  // یه لحظه کوتاهه، ولی بدون این، محتوای پنل برای یه فریم به
  // کاربرِ لاگین‌نکرده هم نشون داده می‌شد
  if (!hydrated || !isAuthenticated) return (
    <div className={`h-screen flex flex-col items-center justify-center gap-4 ${theme === "dark" ? "dark bg-gray-900" : "bg-gray-50"}`} dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-pulse">
        <Stethoscope className="w-6 h-6 text-white" />
      </div>
      <div className="text-sm text-gray-400">{t.common.loading}</div>
    </div>
  );

  return (
    // کل صفحه = ردیف افقی | ارتفاع کامل صفحه | بدون اسکرول کلی
    // dir = جهت متن بسته به زبان (rtl فارسی، ltr انگلیسی)
    // کلاس "dark" اینجا (نه روی <html>) اضافه میشه تا حالت تاریک فقط
    // به پنل مدیریت محدود بمونه و صفحات ورود/پورتال بیمار رو تحت‌تاثیر نذاره
    <div className={`flex h-screen overflow-hidden ${theme === "dark" ? "dark bg-gray-900" : "bg-gray-50"}`} dir={lang === "fa" ? "rtl" : "ltr"}>

      {/* ─── پرده تار پشت کشو (فقط موبایل) ───────────────────── */}
      {/* با کلیک روش کشو بسته میشه */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* ─── نوار کناری (Sidebar) ─────────────────────────────── */}
      {/* موبایل: کشوی رویی که با translate از کنار میاد بیرون */}
      {/* دسکتاپ: ستون ثابت که بین ۲۵۶px و ۸۰px عوض میشه */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-64 bg-white border-e border-gray-100 flex flex-col shadow-sm
          transition-transform duration-300 ease-out
          ${drawerOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"}
          lg:static lg:z-auto lg:shadow-none lg:translate-x-0 lg:rtl:translate-x-0
          lg:transition-[width] lg:flex-shrink-0 ${sidebarOpen ? "lg:w-64" : "lg:w-20"}`}
      >

        {/* لوگوی کلینیک در بالای منو */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* آیکون گوشی پزشکی - همیشه نشون داده میشه */}
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            {/* متن نام کلینیک - وقتی منو جمع شده روی دسکتاپ مخفی میشه */}
            <div className={`min-w-0 ${labelHidden}`}>
              <div className="font-bold text-gray-900 text-sm leading-tight truncate">
                {lang === "fa" ? "کلینیک دکتر" : "Dr. Clinic"}
              </div>
              <div className="text-xs text-gray-400 truncate">{lang === "fa" ? "سیستم مدیریت" : "Management"}</div>
            </div>
          </div>

          {/* دکمه بستن کشو — فقط روی موبایل */}
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label={txt.closeMenu}
            className="lg:hidden p-1.5 -me-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* لیست لینک‌های منو */}
        {/* overflow-y-auto = اگه خیلی زیاد شد اسکرول بده */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            // صفحه فعلی یا یکی از زیرصفحه‌هاش = فعال
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              // Link = کامپوننت Next.js برای لینک‌دهی بدون reload صفحه
              <Link
                key={item.href}
                href={item.href}
                // وقتی منو جمع شده، اسم صفحه رو به شکل tooltip نشون بده
                title={sidebarOpen ? undefined : item.label}
                aria-current={active ? "page" : undefined}
                className="block"
              >
                <div className={`sidebar-item ${active ? "active" : ""} ${sidebarOpen ? "" : "lg:justify-center"}`}>
                  {/* آیکون - همیشه نشون داده میشه */}
                  <span className="flex-shrink-0">{item.icon}</span>
                  {/* متن - وقتی منو جمع شده روی دسکتاپ مخفی میشه */}
                  <span className={`text-sm font-medium flex-1 truncate ${labelHidden}`}>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* اطلاعات کاربر در پایین منو */}
        <div className="p-3 border-t border-gray-100">
          <div className={`flex items-center gap-3 p-2 rounded-xl ${sidebarOpen ? "" : "lg:justify-center"}`}>

            {/* حرف اول نام کاربر به عنوان آواتار */}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(user?.fullName || user?.fullNameEn || "U").trim().charAt(0) || "U"}
              {/* مثلاً اگه نام "علی احمدی" بود، حرف "ع" نشون میده */}
            </div>

            <div className={`flex-1 min-w-0 ${labelHidden}`}>
              {/* نام کاربر: فارسی یا انگلیسی بسته به زبان */}
              <div className="text-sm font-medium text-gray-900 truncate">
                {(lang === "fa" ? user?.fullName : user?.fullNameEn) || user?.fullName || "—"}
              </div>
              {/* نقش کاربر: دکتر / منشی / بیمار */}
              <div className="text-xs text-gray-400 truncate">{roleLabel}</div>
            </div>

            {/* دکمه خروج — همیشه دیده میشه */}
            {/* قبلاً فقط با hover ظاهر می‌شد که روی موبایل اصلاً قابل استفاده نبود */}
            <button
              onClick={handleLogout}
              title={t.auth.logout}
              aria-label={t.auth.logout}
              className={`p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0 ${labelHidden}`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* وقتی منو جمع شده، دکمه خروج جدا و زیر آواتار میاد */}
          {!sidebarOpen && (
            <button
              onClick={handleLogout}
              title={t.auth.logout}
              aria-label={t.auth.logout}
              className="hidden lg:flex w-full items-center justify-center p-2 mt-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ─── بخش اصلی صفحه (کنار منو) ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* نوار بالای صفحه (Header) */}
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-sm flex-shrink-0">

          {/* سمت شروع هدر: دکمه منو + عنوان صفحه */}
          <div className="flex items-center gap-3 min-w-0">

            {/* موبایل: باز کردن کشو */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={txt.openMenu}
              className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* دسکتاپ: جمع/باز کردن منو */}
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? txt.collapse : txt.expand}
              title={sidebarOpen ? txt.collapse : txt.expand}
              className="hidden lg:block text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {sidebarOpen
                ? <PanelLeftClose className="w-5 h-5 rtl:-scale-x-100" />
                : <PanelLeftOpen className="w-5 h-5 rtl:-scale-x-100" />}
            </button>

            {/* عنوان صفحه‌ای که الان توش هستیم */}
            {/* قبلاً هدر خالی بود و معلوم نبود کجای پنل هستی */}
            <h2 className="font-semibold text-gray-800 truncate">{currentTitle}</h2>
          </div>

          {/* دکمه‌های گوشه پایانی هدر */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* جست‌وجوی سراسری بیمار/نوبت — Ctrl+K از هر صفحه‌ای باز میشه */}
            <GlobalSearch />

            {/* دکمه تغییر حالت روشن/تاریک — انتخاب کاربر ذخیره و در بازدید بعدی حفظ میشه */}
            <button
              onClick={toggleTheme}
              aria-label={txt.switchTheme}
              title={txt.switchTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* دکمه تغییر زبان (فارسی/انگلیسی) */}
            <button
              onClick={() => setLang(lang === "fa" ? "en" : "fa")}
              aria-label={txt.switchLang}
              title={txt.switchLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <Globe className="w-4 h-4" />
              {lang === "fa" ? "EN" : "FA"} {/* نشون میده با کلیک به کدوم زبان میره */}
            </button>

            {/* ─── اعلان‌ها ─────────────────────────────────── */}
            <div className="relative" ref={notifRef}>
              {/* دکمه زنگ — با کلیک لیست باز میشه */}
              <button
                onClick={openNotifications}
                aria-label={t.notifications.title}
                aria-expanded={notifOpen}
                title={t.notifications.title}
                className={`relative p-2 rounded-lg transition ${notifOpen ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
              >
                <Bell className="w-5 h-5" />
                {/* اگه اعلان خوانده‌نشده داشتیم، یه دایره قرمز با عدد */}
                {notifCount > 0 && (
                  // -top-0.5 -end-0.5 = گوشه بالای زنگ قرار بگیره
                  <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                    {notifCount > 9 ? "9+" : notifCount.toLocaleString(lang === "fa" ? "fa-IR" : "en")}
                  </span>
                )}
              </button>

              {/* لیست کشویی اعلان‌ها */}
              {notifOpen && (
                <div className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">

                  {/* سربرگ لیست + دکمه «همه رو خوندم» */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-sm text-gray-900">{t.notifications.title}</span>
                    {notifCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                        {t.notifications.markAllRead}
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      // در حال بارگذاری: سه ردیف خاکستری
                      <div className="p-3 space-y-2 animate-pulse">
                        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
                      </div>
                    ) : notifItems.length === 0 ? (
                      // هیچ اعلانی نیست
                      <div className="px-4 py-10 text-center text-sm text-gray-400">
                        {t.notifications.noNotifications}
                      </div>
                    ) : notifItems.map(n => (
                      // اعلان خوانده‌نشده پس‌زمینه آبی کم‌رنگ داره
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-50 last:border-0 ${n.isRead ? "" : "bg-blue-50/50"}`}>
                        <div className="flex items-start gap-2">
                          {/* نقطه آبی کنار اعلان خوانده‌نشده */}
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {(lang === "fa" ? n.title : n.titleEn) || n.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {(lang === "fa" ? n.message : n.messageEn) || n.message}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              {new Date(n.createdAt).toLocaleDateString(lang === "fa" ? "fa-IR" : "en", {
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* محتوای صفحه (اینجا هر صفحه‌ای که داخل Layout قرار می‌گیره نشون داده میشه) */}
        {/* overflow-y-auto = اگه محتوا بلند بود، فقط این بخش اسکرول بخوره */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
          {/* children = صفحه‌ای که الان توش هستیم (داشبورد، بیماران و...) */}
        </main>
      </div>
    </div>
  );
}
