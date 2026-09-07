// ══════════════════════════════════════════════════════════════
// این فایل "ارتباط با سرور" رو مدیریت می‌کنه
// Axios یه کتابخونه‌ی محبوب برای ارسال درخواست HTTP هست
//
// اینجا دو کار مهم انجام میشه:
// ۱. قبل از هر درخواست: توکن رو به هدر اضافه می‌کنه (Authorization)
// ۲. وقتی سرور 401 برگردوند (توکن منقضی): توکن رو تمدید می‌کنه
//    اگه تمدید ناموفق بود: کاربر رو به صفحه لاگین هدایت می‌کنه
//
// بعدش همه API های برنامه رو به صورت توابع آماده تعریف کردیم
// ══════════════════════════════════════════════════════════════
import axios from "axios";
import { useAuthStore } from "@/store/useStore";

// آدرس سرور API - از متغیر محیطی می‌خونه (یا localhost:5000 پیش‌فرض)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// یه instance از axios با آدرس پایه سرور بساز
// همه درخواست‌ها از این instance استفاده می‌کنن
export const api = axios.create({ baseURL: API_URL });

// ─── Interceptor درخواست (قبل از ارسال) ──────────────────────
// هر بار که می‌خوایم چیزی به سرور بفرستیم، اول از اینجا رد میشه
// توکن JWT رو به هدر Authorization اضافه می‌کنه
// سرور با این توکن می‌فهمه کیی!
api.interceptors.request.use((config) => {
  // توکن رو از Store بخون
  const token = useAuthStore.getState().accessToken;
  // اگه توکن داشتیم به هدر اضافه کن: "Bearer eyJhbGci..."
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Interceptor پاسخ (بعد از دریافت) ────────────────────────
// وقتی سرور جواب میده، اول از اینجا رد میشه
api.interceptors.response.use(
  // اگه موفق بود (200-299): بدون تغییر برگردون
  (res) => res,

  // اگه خطا بود:
  async (error) => {
    const original = error.config; // اطلاعات درخواست اصلی

    // اگه خطا ۴۰۱ بود (توکن منقضی) و قبلاً یه بار امتحان نکردیم
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true; // علامت بزن که دوباره امتحان می‌کنیم (جلوی حلقه بی‌نهایت رو می‌گیره)

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          // از سرور توکن جدید بگیر
          const { data } = await axios.post(`${API_URL}/auth/refresh`, JSON.stringify(refreshToken), {
            headers: { "Content-Type": "application/json" },
          });

          // توکن جدید رو در Store ذخیره کن
          useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

          // درخواست اصلی رو با توکن جدید دوباره بفرست
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          // اگه refresh هم ناموفق بود، لاگ‌اوت کن و به صفحه لاگین بفرست
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error); // خطا رو به caller برگردون
  }
);

// ══════════════════════════════════════════════════════════════
// API های آماده
// به جای اینکه هر جا axios.get/post بنویسیم، اینجا یه بار تعریف می‌کنیم
// و هر جا لازم بود import می‌کنیم
// ══════════════════════════════════════════════════════════════

// ─── API احراز هویت ───────────────────────────────────────────
export const authApi = {
  login: (data: { userName: string; password: string }) => api.post("/auth/login", data),
  register: (data: object) => api.post("/auth/register", data),
  logout: () => api.post("/auth/logout"),
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (data: object) => api.put("/auth/profile", data),
  changePassword: (data: object) => api.post("/auth/change-password", data),
};

// ─── API نوبت‌ها ───────────────────────────────────────────────
export const appointmentApi = {
  getAll: (params: object) => api.get("/appointments", { params }),              // لیست با فیلتر
  getById: (id: string) => api.get(`/appointments/${id}`),                       // یه نوبت خاص
  getToday: (doctorId: string) => api.get("/appointments/today", { params: { doctorId } }), // نوبت‌های امروز
  getAvailableSlots: (doctorId: string, date: string) =>
    api.get("/appointments/available-slots", { params: { doctorId, date } }),   // زمان‌های خالی
  create: (data: object) => api.post("/appointments", data),                     // ثبت نوبت
  update: (id: string, data: object) => api.put(`/appointments/${id}`, data),   // ویرایش نوبت
  updateStatus: (id: string, data: object) => api.patch(`/appointments/${id}/status`, data), // تغییر وضعیت
  delete: (id: string) => api.delete(`/appointments/${id}`),                    // حذف نوبت
};

// ─── API بیماران ───────────────────────────────────────────────
export const patientApi = {
  getAll: (params: object) => api.get("/patients", { params }),                 // لیست با جستجو
  getById: (id: string) => api.get(`/patients/${id}`),                         // پرونده کامل بیمار
  getMe: () => api.get("/patients/me"),                                         // پروفایل خود بیمار
  update: (id: string, data: object) => api.put(`/patients/${id}`, data),      // ویرایش پرونده
  getVitalTrends: (id: string, params?: object) => api.get(`/patients/${id}/vitals`, { params }), // نمودار علائم حیاتی
  addVital: (id: string, data: object) => api.post(`/patients/${id}/vitals`, data), // ثبت علامت حیاتی
};

export const doctorApi = {
  getAll: () => api.get("/doctors"),
};

export const branchApi = {
  getAll: () => api.get("/branches"),
  create: (data: object) => api.post("/branches", data),
  update: (id: string, data: object) => api.put(`/branches/${id}`, data),
};

export const visitQueueApi = {
  getAll: (params?: object) => api.get("/visit-queue", { params }),
  checkIn: (appointmentId: string, notes?: string) =>
    api.post(`/visit-queue/check-in/${appointmentId}`, { notes }),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/visit-queue/${id}/status`, { status, notes }),
};

export const billingApi = {
  getInvoices: (params?: object) => api.get("/billing/invoices", { params }),
  createInvoice: (data: object) => api.post("/billing/invoices", data),
  addPayment: (id: string, data: object) => api.post(`/billing/invoices/${id}/payments`, data),
  voidInvoice: (id: string) => api.post(`/billing/invoices/${id}/void`),
  createClaim: (id: string, data: object) => api.post(`/billing/invoices/${id}/insurance-claims`, data),
  updateClaimStatus: (id: string, data: object) => api.patch(`/billing/insurance-claims/${id}/status`, data),
};

export const inventoryApi = {
  getAll: (params?: object) => api.get("/inventory", { params }),
  create: (data: object) => api.post("/inventory", data),
  adjust: (id: string, data: object) => api.post(`/inventory/${id}/adjust`, data),
  getTransactions: (id: string) => api.get(`/inventory/${id}/transactions`),
};

export const auditApi = {
  getAll: (params?: object) => api.get("/audit", { params }),
};

export const integrationApi = {
  getStatus: () => api.get("/integrations/status"),
  calendarUrl: (appointmentId: string) => `${API_URL}/integrations/calendar/${appointmentId}.ics`,
  // این اندپوینت نیاز به هدر Authorization داره، پس نمیشه با یه لینک ساده <a href>
  // دانلودش کرد (ناوبری مستقیم توکن رو نمی‌فرسته و ۴۰۱ می‌گیریم) —
  // باید از طریق axios با responseType: "blob" گرفته بشه و بعد دانلود بشه
  downloadCalendar: (appointmentId: string) =>
    api.get(`/integrations/calendar/${appointmentId}.ics`, { responseType: "blob" }),
  createTelemedicineSession: (appointmentId: string) =>
    api.post(`/integrations/telemedicine/${appointmentId}/session`),
};

export const medicalFileApi = {
  getAll: (params?: object) => api.get("/medical-files", { params }),
  upload: (formData: FormData) => api.post("/medical-files", formData),
  download: (id: string) => api.get(`/medical-files/${id}/download`, { responseType: "blob" }),
  delete: (id: string) => api.delete(`/medical-files/${id}`),
};

// ─── API مشاوره آنلاین ────────────────────────────────────────
export const consultationApi = {
  getAll: (params?: object) => api.get("/consultations", { params }),          // لیست مشاوره‌ها
  getById: (id: string) => api.get(`/consultations/${id}`),                    // یه مشاوره خاص
  create: (data: object) => api.post("/consultations", data),                  // شروع مشاوره
  answer: (id: string, data: object) => api.patch(`/consultations/${id}/answer`, data), // دکتر جواب بده
  updateStatus: (id: string, data: object) => api.patch(`/consultations/${id}/status`, data), // تغییر وضعیت
};

export const medicalRecordApi = {
  getAll: () => api.get("/medicalrecords"),
  getByPatient: (patientId: string) => api.get("/medicalrecords", { params: { patientId } }),
  getById: (id: string) => api.get(`/medicalrecords/${id}`),
  create: (data: object) => api.post("/medicalrecords", data),
};

export const prescriptionApi = {
  getAll: () => api.get("/prescriptions"),
  getByPatient: (patientId: string) => api.get("/prescriptions", { params: { patientId } }),
  getById: (id: string) => api.get(`/prescriptions/${id}`),
  create: (data: object) => api.post("/prescriptions", data),
};

// ─── API اعلان‌ها ──────────────────────────────────────────────
export const notificationApi = {
  getAll: (params?: object) => api.get("/notifications", { params }),          // همه اعلان‌ها
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),            // یه اعلان رو خوانده علامت بزن
  markAllRead: () => api.patch("/notifications/read-all"),                     // همه رو خوانده علامت بزن
};

// ─── API داشبورد ──────────────────────────────────────────────
export const reportApi = {
  getSummary: (period: "week" | "month" | "year") =>
    api.get("/reports/summary", { params: { period } }),
};

export const dashboardApi = {
  getStats: () => api.get("/dashboard/stats"), // آمار کلی: تعداد بیماران، نوبت‌ها و...
};
