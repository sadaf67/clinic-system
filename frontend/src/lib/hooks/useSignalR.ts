// ══════════════════════════════════════════════════════════════
// فایل useSignalR.ts — هوک اتصال به چت آنلاین (SignalR)
//
// SignalR یه تکنولوژیه که اجازه میده سرور بدون اینکه کاربر
// صفحه رو رفرش کنه، پیام بفرسته — مثل واتساپ!
//
// این هوک کارهای زیر رو انجام میده:
// ۱. یه اتصال دائمی WebSocket به سرور می‌زنه
// ۲. وقتی پیام جدیدی میاد، اون رو به لیست پیام‌ها اضافه می‌کنه
// ۳. امکان فرستادن پیام و علامت خوانده‌شدن رو میده
// ══════════════════════════════════════════════════════════════

// useEffect = برای راه‌اندازی و قطع کردن اتصال
// useRef = برای نگه‌داشتن reference به اتصال (بدون re-render)
// useState = برای نگه‌داشتن وضعیت اتصال و لیست پیام‌ها
import { useEffect, useRef, useState } from "react";

// signalR = کتابخونه Microsoft برای اتصال به SignalR Hub
import * as signalR from "@microsoft/signalr";

// برای خوندن توکن JWT (برای احراز هویت در WebSocket)
import { useAuthStore } from "@/store/useStore";

// آدرس سرور — از متغیر محیطی خونده میشه، وگرنه localhost
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "http://localhost:5000";

// ──────────────────────────────────────────────────────────────
// useConsultationHub: هوک اصلی اتصال به چت مشاوره
//
// پارامتر:
// consultationId = شناسه مشاوره‌ای که می‌خوایم چتش رو ببینیم
//
// خروجی:
// connected   = آیا الان به سرور وصل هستیم؟
// messages    = لیست پیام‌های این مشاوره
// setMessages = برای ست کردن پیام‌های اولیه از API
// sendMessage = برای فرستادن پیام جدید
// markRead    = برای علامت زدن همه پیام‌ها به عنوان خوانده‌شده
// ──────────────────────────────────────────────────────────────
export function useConsultationHub(consultationId: string | null) {
  const { accessToken } = useAuthStore(); // توکن JWT برای احراز هویت

  // connectionRef: یه reference به اتصال SignalR
  // از useRef استفاده می‌کنیم چون نمی‌خوایم تغییرش باعث re-render بشه
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const [connected, setConnected] = useState(false);              // آیا متصل هستیم؟
  const [messages, setMessages] = useState<ConsultationMessage[]>([]); // لیست پیام‌ها

  // ── راه‌اندازی اتصال SignalR ─────────────────────────────
  // این کد وقتی کامپوننت لود میشه اجرا میشه
  // وقتی کامپوننت از صفحه حذف میشه، اتصال قطع میشه (cleanup)
  useEffect(() => {
    // اگه توکن نداریم یا مشاوره مشخص نشده، کاری نکن
    if (!accessToken || !consultationId) return;

    // ساختن اتصال جدید به SignalR Hub
    const connection = new signalR.HubConnectionBuilder()
      // آدرس Hub + توکن JWT در query string (برای احراز هویت)
      .withUrl(`${HUB_URL}/hubs/consultation?access_token=${accessToken}`)
      // اگه اتصال قطع شد، خودکار دوباره وصل میشه
      .withAutomaticReconnect()
      .build();

    // ── گوش دادن به پیام‌های جدید از سرور ───────────────
    // وقتی سرور "ReceiveMessage" رو صدا می‌زنه، این تابع اجرا میشه
    // یعنی یه پیام جدید اومده — اون رو به لیست اضافه می‌کنیم
    connection.on("ReceiveMessage", (msg: ConsultationMessage) => {
      setMessages(prev => [...prev, msg]); // پیام جدید رو به آخر لیست اضافه کن
    });

    // ── شروع اتصال ───────────────────────────────────────
    connection.start()
      .then(() => {
        setConnected(true); // اتصال برقرار شد

        // به سرور میگیم: "من می‌خوام پیام‌های این مشاوره رو ببینم"
        connection.invoke("JoinConsultation", consultationId);
      })
      .catch(console.error); // اگه خطا بود، توی console چاپ کن

    // اتصال رو توی ref ذخیره می‌کنیم تا بعداً بتونیم ازش استفاده کنیم
    connectionRef.current = connection;

    // ── cleanup: وقتی کامپوننت بسته میشه ────────────────
    // به سرور میگیم "دارم میرم" و اتصال رو قطع می‌کنیم
    return () => {
      connection.invoke("LeaveConsultation", consultationId).catch(() => {});
      connection.stop(); // قطع کردن اتصال WebSocket
    };
  }, [accessToken, consultationId]); // فقط وقتی توکن یا id مشاوره عوض شد، دوباره اجرا شه

  // ── sendMessage: فرستادن پیام ─────────────────────────
  // content = متن پیامی که کاربر نوشته
  // سرور این پیام رو به همه اعضای اتاق میفرسته
  const sendMessage = async (content: string) => {
    if (!connectionRef.current || !consultationId) return;
    await connectionRef.current.invoke("SendMessage", consultationId, content);
  };

  // ── markRead: علامت زدن پیام‌ها به عنوان خوانده‌شده ──
  // وقتی کاربر وارد چت میشه، همه پیام‌های خوانده‌نشده رو خوانده می‌کنه
  const markRead = async () => {
    if (!connectionRef.current || !consultationId) return;
    await connectionRef.current.invoke("MarkMessagesRead", consultationId);
  };

  // برگردوندن همه چیزهایی که کامپوننت چت بهشون نیاز داره
  return { connected, messages, setMessages, sendMessage, markRead };
}

// ──────────────────────────────────────────────────────────────
// ConsultationMessage: نوع TypeScript برای ساختار یه پیام چت
//
// هر پیام این اطلاعات رو داره:
// id          = شناسه یکتا پیام
// senderId    = شناسه فرستنده (برای اینکه بفهمیم پیام از ماست یا نه)
// senderName  = اسم فرستنده
// isDoctor    = آیا فرستنده دکتره؟ (برای نشون دادن badge دکتر)
// content     = متن پیام
// sentAt      = زمان ارسال پیام
// ──────────────────────────────────────────────────────────────
export interface ConsultationMessage {
  id:         string;
  senderId:   string;
  senderName: string;
  isDoctor:   boolean;
  content:    string;
  sentAt:     string;
}

// ══════════════════════════════════════════════════════════════
// useNotificationHub: هوک اعلان‌های لحظه‌ای (بدون نیاز به رفرش)
//
// چرا از همون ConsultationHub استفاده می‌کنیم؟
// سمت بک‌اند، ConsultationHub توی OnConnectedAsync هر کاربر
// لاگین‌شده رو خودکار به یه گروه شخصی ("user_{userId}") اضافه
// می‌کنه — فارغ از اینکه توی صفحه چت باشه یا نه. پس همین یه
// اتصال WebSocket برای گرفتن اعلان‌های لحظه‌ای هم کافیه؛ لازم
// نیست یه Hub یا اتصال جداگانه بسازیم.
//
// این هوک باید یه بار توی AdminLayout (سطح کل پنل) صدا زده بشه،
// نه توی هر صفحه — تا با رفتن بین صفحات قطع/وصل نشه.
// ══════════════════════════════════════════════════════════════
export interface NotificationPayload {
  id:                string;
  type:               number | string;
  status:             number | string;
  title:              string;
  titleEn:            string;
  message:            string;
  messageEn:          string;
  isRead:             boolean;
  sentAt:             string | null;
  relatedEntityId?:   string | null;
  relatedEntityType?: string | null;
  createdAt:          string;
}

export function useNotificationHub(onNotification: (n: NotificationPayload) => void) {
  const { accessToken, isAuthenticated } = useAuthStore();

  // handlerRef: همیشه آخرین نسخه‌ی callback رو نگه می‌داره
  // بدون این، هر re-render باعث قطع/وصل دوباره اتصال WebSocket می‌شد
  // چون تابع onNotification هر بار یه reference جدیده
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    if (!accessToken || !isAuthenticated) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${HUB_URL}/hubs/consultation?access_token=${accessToken}`)
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveNotification", (payload: NotificationPayload) => {
      handlerRef.current(payload);
    });

    // اگه وصل نشد (مثلاً سرور موقتاً پایینه)، بی‌سروصدا رد شو —
    // نوتیفیکیشن‌ها همچنان با polling معمولی صفحه‌ها کار می‌کنن،
    // این هوک فقط یه لایه‌ی «فوری‌تر» روشه
    connection.start().catch(() => {});

    return () => {
      connection.stop();
    };
  }, [accessToken, isAuthenticated]);
}
