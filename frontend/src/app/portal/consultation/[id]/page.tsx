"use client";

// ══════════════════════════════════════════════════════════════
// صفحه چت مشاوره آنلاین (Consultation Chat Page)
//
// این صفحه یه چت آنلاین بین بیمار و دکتر هست — مثل واتساپ!
//
// آدرسش: /portal/consultation/[id]
// مثلاً: /portal/consultation/abc-123
//
// ویژگی‌ها:
// - پیام‌ها رو از API می‌گیره
// - اتصال دائمی WebSocket (SignalR) داره — پیام‌های جدید خودکار میان
// - بیمار پیامش آبیه، دکتر پیامش سفید/خاکستریه
// - وقتی پیام جدید میاد، صفحه اسکرول میشه پایین
// ══════════════════════════════════════════════════════════════

// useEffect = برای بارگذاری اولیه و اسکرول خودکار
// useRef = برای اشاره به آخرین پیام (برای اسکرول)
// useState = برای نگه‌داری ورودی و داده مشاوره
import { useEffect, useRef, useState } from "react";

// useParams = برای خوندن [id] از آدرس URL
// useRouter = برای برگشت به لیست مشاوره‌ها
import { useParams, useRouter } from "next/navigation";

// استورهای اطلاعات کاربر و زبان
import { useAuthStore, useAppStore } from "@/store/useStore";

// consultationApi = توابع API مربوط به مشاوره
import { consultationApi } from "@/lib/api/axios";

// هوک SignalR برای چت آنلاین
import { useConsultationHub } from "@/lib/hooks/useSignalR";

// آیکون‌ها
import { Send, Circle, ArrowRight, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

// ──────────────────────────────────────────────────────────────
// ConsultationChatPage: صفحه اصلی چت مشاوره
// ──────────────────────────────────────────────────────────────
export default function ConsultationChatPage() {
  // id = شناسه مشاوره از URL (مثلاً "abc-123")
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { user } = useAuthStore();    // اطلاعات کاربر لاگین‌کرده
  const { lang } = useAppStore();     // زبان فعلی

  // input = متنی که کاربر داره تایپ می‌کنه
  const [input, setInput] = useState("");

  // consultation = اطلاعات کلی مشاوره (نام بیمار، نام دکتر و...)
  const [consultation, setConsultation] = useState<any>(null);
  const [loadError, setLoadError] = useState(false); // اگه مشاوره پیدا نشد یا خطا خورد

  // bottomRef = یه ref به آخرین پیام — برای اسکرول به پایین
  const bottomRef = useRef<HTMLDivElement>(null);

  // هوک SignalR — همه چیز مربوط به چت آنلاین
  const { connected, messages, setMessages, sendMessage, markRead } = useConsultationHub(id);

  // ── بارگذاری اطلاعات مشاوره از API ──────────────────────
  // وقتی صفحه لود میشه، اطلاعات و پیام‌های قبلی رو میگیره
  useEffect(() => {
    consultationApi.getById(id).then(res => {
      setConsultation(res.data.consultation);          // اطلاعات مشاوره
      setMessages(res.data.messages || []);             // پیام‌های قبلی
    }).catch(() => {
      // قبلاً اگه این درخواست خطا می‌خورد، صفحه برای همیشه در حال بارگذاری می‌موند
      setLoadError(true);
      toast.error(lang === "fa" ? "دریافت اطلاعات مشاوره ناموفق بود" : "Could not load this consultation");
    });
  }, [id]);

  // ── اسکرول خودکار + خوانده‌شدن پیام‌ها ─────────────────
  // هر بار که پیام جدیدی میاد، برو پایین
  // همچنین اگه متصل هستیم، پیام‌ها رو خوانده علامت بزن
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" }); // اسکرول به پایین
    if (connected) markRead(); // پیام‌ها رو خوانده‌شده علامت بزن
  }, [messages, connected]);

  // ── handleSend: ارسال پیام ──────────────────────────────
  // وقتی دکمه ارسال زده میشه یا Enter فشرده میشه
  const handleSend = async () => {
    if (!input.trim()) return; // اگه خالیه، کاری نکن
    await sendMessage(input.trim()); // پیام رو از طریق SignalR بفرست
    setInput(""); // فیلد رو خالی کن
  };

  // تشخیص اینکه آیا کاربر فعلی دکتره یا نه
  // SuperAdmin = دکتر، Admin = منشی (هر دو طرف دکتر هستن)
  const isDoctor = user?.role === "SuperAdmin" || user?.role === "Admin";

  // مسیر برگشت: دکتر/منشی به لیست مشاوره‌های ادمین، بیمار به پرتال خودش
  const backHref = isDoctor ? "/admin/consultations" : "/portal";
  // در RTL فلش برگشت باید به سمت راست باشه
  const BackIcon = lang === "fa" ? ArrowRight : ArrowLeft;

  // ── حالت خطا: مشاوره پیدا نشد ────────────────────────────
  if (loadError) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen bg-gray-50 gap-4 ${lang === "fa" ? "rtl" : "ltr"}`} dir={lang === "fa" ? "rtl" : "ltr"}>
        <p className="text-gray-500">
          {lang === "fa" ? "این مشاوره پیدا نشد یا به آن دسترسی ندارید" : "This consultation was not found or you don't have access"}
        </p>
        <button onClick={() => router.push(backHref)} className="btn-secondary flex items-center gap-2">
          <BackIcon className="w-4 h-4" />
          {lang === "fa" ? "بازگشت" : "Back"}
        </button>
      </div>
    );
  }

  // ── حالت بارگذاری ────────────────────────────────────────
  if (!consultation) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen bg-gray-50 ${lang === "fa" ? "rtl" : "ltr"}`}
      dir={lang === "fa" ? "rtl" : "ltr"}
    >

      {/* ── هدر چت ──────────────────────────────────────────
          نام طرف مقابل + وضعیت اتصال (سبز = متصل، خاکستری = در حال اتصال)
      ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        {/* دکمه بازگشت — قبلاً راهی برای خروج از این صفحه تمام‌صفحه نبود */}
        <button
          onClick={() => router.push(backHref)}
          aria-label={lang === "fa" ? "بازگشت" : "Back"}
          className="p-2 -ms-2 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
        >
          <BackIcon className="w-5 h-5" />
        </button>
        {/* آواتار — اولین حرف اسم طرف مقابل */}
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">
          {consultation?.patientName?.[0] || "؟"}
        </div>
        <div>
          {/* نام طرف مقابل — دکتر اسم بیمار رو میبینه، بیمار اسم دکتر رو */}
          <div className="font-semibold text-gray-900">
            {isDoctor ? consultation?.patientName : consultation?.doctorName}
          </div>
          {/* وضعیت اتصال WebSocket */}
          <div className="flex items-center gap-1.5 text-xs">
            {/* دایره سبز = متصل، خاکستری = در حال وصل شدن */}
            <Circle className={`w-2 h-2 fill-current ${connected ? "text-green-500" : "text-gray-400"}`} />
            <span className="text-gray-400">
              {connected
                ? (lang === "fa" ? "متصل" : "Connected")
                : (lang === "fa" ? "در حال اتصال..." : "Connecting...")}
            </span>
          </div>
        </div>
      </div>

      {/* ── لیست پیام‌ها ─────────────────────────────────────
          flex-1 = فضای خالی رو پر می‌کنه
          overflow-y-auto = اگه پیام‌ها زیاد شدن، اسکرول بار نشون بده
      ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          // آیا این پیام از طرف خودمونه؟
          const isMine = msg.senderId === user?.id;

          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              // پیام خودمون سمت راسته، پیام دیگری سمت چپ
            >
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                isMine
                  ? "bg-blue-600 text-white rounded-br-sm"    // پیام خودمون: آبی، گوشه پایین راست نداره
                  : "bg-white text-gray-800 rounded-bl-sm border border-gray-100" // پیام دیگری: سفید
              }`}>
                {/* اسم فرستنده — فقط برای پیام‌های دیگران نشون داده میشه */}
                {!isMine && (
                  <div className={`text-xs font-semibold mb-1 ${msg.isDoctor ? "text-blue-500" : "text-gray-400"}`}>
                    {msg.senderName}
                    {/* اگه دکتره، "(پزشک)" نشون بده */}
                    {msg.isDoctor && <span className="ms-1">{lang === "fa" ? "(پزشک)" : "(Doctor)"}</span>}
                  </div>
                )}

                {/* متن پیام */}
                <div className="text-sm leading-relaxed">{msg.content}</div>

                {/* زمان ارسال پیام — گوشه پایین */}
                <div className={`text-[10px] mt-1 text-end ${isMine ? "text-blue-200" : "text-gray-400"}`}>
                  {new Date(msg.sentAt).toLocaleTimeString(
                    lang === "fa" ? "fa-IR" : "en",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* اگه هنوز هیچ پیامی نیست */}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">
            {lang === "fa" ? "هنوز پیامی ارسال نشده" : "No messages yet"}
          </div>
        )}

        {/* یه div خالی که برای اسکرول به پایین استفاده میشه */}
        <div ref={bottomRef} />
      </div>

      {/* ── کادر ورودی پیام ─────────────────────────────────
          در پایین صفحه ثابته
          Enter = ارسال پیام (بدون Shift)
          Shift+Enter = خط جدید (معمولاً)
      ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-t p-4">
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} // Enter = ارسال
            placeholder={lang === "fa" ? "پیام خود را بنویسید..." : "Type a message..."}
            className="flex-1 input-field"
          />

          {/* دکمه ارسال — غیرفعاله اگه پیام خالیه یا متصل نیستیم */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="btn-primary p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
