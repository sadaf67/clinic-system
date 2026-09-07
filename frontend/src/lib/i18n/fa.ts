// ══════════════════════════════════════════════════════════════
// فایل ترجمه‌های فارسی
//
// این فایل یه "دیکشنری" فارسیه:
// هر کلید (key) = یه متن مخصوص
// وقتی برنامه فارسی هست، این متن‌ها نشون داده میشن
//
// ساختار درختی داره:
// common = کلمات عمومی (ذخیره، لغو، حذف...)
// auth = مربوط به ورود و خروج
// nav = منوی ناوبری
// dashboard = داشبورد
// appointment = نوبت‌ها
// و ...
// ══════════════════════════════════════════════════════════════
export const fa = {

  // ─── کلمات عمومی که همه جا استفاده میشن ─────────────────────
  common: {
    save:     "ذخیره",          // دکمه ذخیره
    cancel:   "لغو",            // دکمه لغو
    delete:   "حذف",            // دکمه حذف
    edit:     "ویرایش",         // دکمه ویرایش
    search:   "جستجو",          // جستجو
    loading:  "در حال بارگذاری...", // وقتی صبر می‌کنیم
    noData:   "داده‌ای یافت نشد",   // وقتی هیچی نیست
    confirm:  "تأیید",          // تأیید کردن
    back:     "بازگشت",         // برگشت به صفحه قبل
    next:     "بعدی",           // رفتن به صفحه بعد
    prev:     "قبلی",           // برگشت به صفحه قبل (صفحه‌بندی)
    yes:      "بله",
    no:       "خیر",
    submit:   "ارسال",
    close:    "بستن",
    details:  "جزئیات",
    actions:  "عملیات",         // ستون دکمه‌ها در جدول
    status:   "وضعیت",
    date:     "تاریخ",
    time:     "ساعت",
    name:     "نام",
    phone:    "شماره موبایل",
    total:    "مجموع",
  },

  // ─── مربوط به ورود/خروج و حساب کاربری ──────────────────────
  auth: {
    login:           "ورود",
    logout:          "خروج",
    register:        "ثبت نام",
    username:        "نام کاربری / شماره موبایل",
    password:        "رمز عبور",
    newPassword:     "رمز عبور جدید",
    currentPassword: "رمز عبور فعلی",
    confirmPassword: "تکرار رمز عبور",
    forgotPassword:  "فراموشی رمز عبور",
    changePassword:  "تغییر رمز عبور",
    loginTitle:      "ورود به سیستم",
    welcome:         "خوش آمدید",
  },

  // ─── نام صفحات در منوی کناری ─────────────────────────────────
  nav: {
    dashboard:     "داشبورد",
    patients:      "بیماران",
    appointments:  "نوبت‌ها",
    medicalRecords:"پرونده پزشکی",
    prescriptions: "نسخه‌ها",
    consultations: "مشاوره آنلاین",
    reports:       "گزارش‌ها",
    settings:      "تنظیمات",
    users:         "کاربران",
    auditLog:      "لاگ فعالیت",
    notifications: "اعلان‌ها",
    profile:       "پروفایل",
    myPanel:       "پنل من",
    visitQueue:    "صف پذیرش",
    billing:       "صورتحساب‌ها",
    inventory:     "انبار",
  },

  // ─── متن‌های داشبورد ─────────────────────────────────────────
  dashboard: {
    title:                  "داشبورد",
    totalPatients:          "کل بیماران",
    todayAppointments:      "نوبت‌های امروز",
    pendingAppointments:    "نوبت‌های در انتظار",
    pendingConsultations:   "مشاوره‌های در انتظار",
    newPatientsMonth:       "بیماران جدید این ماه",
    completedVisitsMonth:   "ویزیت‌های کامل‌شده این ماه",
    upcomingToday:          "نوبت‌های پیش رو امروز",
    weeklyChart:            "نمودار هفتگی نوبت‌ها",
    monthlyChart:           "بیماران جدید ماهانه",
  },

  // ─── مربوط به نوبت‌ها ─────────────────────────────────────────
  appointment: {
    title:           "نوبت‌ها",
    new:             "نوبت جدید",
    date:            "تاریخ نوبت",
    time:            "ساعت",
    type:            "نوع",
    inPerson:        "حضوری",        // ویزیت حضوری
    online:          "آنلاین",        // ویزیت آنلاین (ویدیویی)
    status: {
      pending:   "در انتظار",        // منتظر تأیید دکتر
      confirmed: "تأیید شده",        // دکتر تأیید کرده
      cancelled: "لغو شده",          // لغو شده
      completed: "انجام شده",        // ویزیت انجام شد
      noShow:    "غایب",             // بیمار نیومد
    },
    chiefComplaint:  "شکایت اصلی",   // علت مراجعه
    notes:           "یادداشت",
    meetingLink:     "لینک ویزیت آنلاین",
    reminder:        "یادآوری",
    availableSlots:  "ساعت‌های خالی",
    bookAppointment: "رزرو نوبت",
  },

  // ─── مربوط به بیماران ──────────────────────────────────────
  patient: {
    title:           "بیماران",
    new:             "بیمار جدید",
    nationalCode:    "کد ملی",
    dateOfBirth:     "تاریخ تولد",
    age:             "سن",
    gender:          { male: "مرد", female: "زن", other: "سایر" },
    bloodType:       "گروه خونی",
    address:         "آدرس",
    insurance:       "بیمه",
    allergies:       "آلرژی‌ها",       // حساسیت‌های دارویی یا غذایی
    chronicDiseases: "بیماری‌های مزمن", // مثلاً دیابت، فشار خون
    medications:     "داروهای جاری",   // داروهایی که الان مصرف می‌کنه
    familyHistory:   "سابقه خانوادگی", // بیماری‌های موروثی خانواده
    emergency:       "تماس اضطراری",   // شماره کسی که اورژانس تماس بگیره
    medicalHistory:  "سابقه پزشکی",
    vitalSigns:      "علائم حیاتی",    // وزن، فشار، ضربان، دما...
    progress:        "پیشرفت / روند",
    weight:          "وزن",
    bloodPressure:   "فشار خون",
    bloodSugar:      "قند خون",
    heartRate:       "ضربان قلب",
    temperature:     "دما",
    oxygenSaturation:"اشباع اکسیژن",   // SpO2 - درصد اکسیژن خون
    bmi:             "شاخص توده بدنی", // BMI
    trends: {
      up:     "افزایشی",  // روند صعودی
      down:   "کاهشی",   // روند نزولی
      stable: "پایدار",  // تغییری نداشته
    },
  },

  // ─── مربوط به نسخه‌ها ──────────────────────────────────────
  prescription: {
    title:      "نسخه‌ها",
    new:        "نسخه جدید",
    medicine:   "دارو",
    dosage:     "دوز",           // مثلاً ۵۰۰mg
    frequency:  "دفعات مصرف",   // مثلاً ۳ بار در روز
    duration:   "مدت",           // مثلاً ۷ روز
    instructions:"دستورالعمل",  // نحوه مصرف
    quantity:   "تعداد",
    issuedDate: "تاریخ صدور",
    expiryDate: "تاریخ انقضا",
    code:       "کد نسخه",       // مثلاً RX-20240615-A3F2
    status: {
      active:    "فعال",     // نسخه هنوز معتبره
      expired:   "منقضی",   // تاریخش گذشته
      cancelled: "لغو",     // لغو شده
    },
  },

  // ─── مربوط به مشاوره آنلاین ────────────────────────────────
  consultation: {
    title:   "مشاوره آنلاین",
    new:     "مشاوره جدید",
    question:"سؤال بیمار",    // سوالی که بیمار پرسیده
    answer:  "پاسخ پزشک",    // جوابی که دکتر داده
    urgent:  "فوری",          // مشاوره اورژانسی
    status: {
      waiting:    "در انتظار",    // منتظر پاسخ دکتر
      inProgress: "در حال بررسی", // دکتر داره بررسی می‌کنه
      completed:  "پاسخ داده شد", // دکتر جواب داد
      cancelled:  "لغو",
    },
    chat: "گفتگو",   // چت زنده با دکتر
    send: "ارسال پیام",
  },

  // ─── اعلان‌ها ─────────────────────────────────────────────
  notifications: {
    title:               "اعلان‌ها",
    markAllRead:         "علامت‌گذاری همه به عنوان خوانده‌شده",
    noNotifications:     "اعلانی وجود ندارد",
    appointmentReminder: "یادآوری نوبت",
    appointmentConfirmed:"نوبت تأیید شد",
    consultationReply:   "پاسخ مشاوره",
  },

  // ─── صورتحساب و پرداخت‌ها (ماژول Billing) ─────────────────
  billing: {
    title:            "صورتحساب‌ها",
    new:              "فاکتور جدید",
    invoiceNumber:    "شماره فاکتور",
    patient:          "بیمار",
    issuedAt:         "تاریخ صدور",
    dueAt:            "سررسید",
    subtotal:         "جمع جزء",
    discount:         "تخفیف",
    insuranceAmount:  "سهم بیمه",
    total:            "مبلغ کل",
    paid:             "پرداخت‌شده",
    outstanding:      "باقی‌مانده",
    notes:            "یادداشت",
    items:            "اقلام فاکتور",
    addItem:          "افزودن قلم",
    description:      "شرح",
    quantity:         "تعداد",
    unitPrice:        "قیمت واحد",
    lineTotal:        "جمع قلم",
    status: {
      draft:         "پیش‌نویس",
      issued:        "صادر شده",
      partiallyPaid: "پرداخت جزئی",
      paid:          "تسویه شده",
      void:          "باطل شده",
    },
    payment: {
      title:     "پرداخت‌ها",
      add:       "ثبت پرداخت",
      amount:    "مبلغ",
      method:    "روش پرداخت",
      reference: "شماره پیگیری",
      methods: { cash: "نقدی", card: "کارتخوان", transfer: "انتقال بانکی", manual: "دستی" },
      status: { pending: "در انتظار", succeeded: "موفق", failed: "ناموفق", refunded: "بازگشت‌داده‌شده" },
    },
    void:             "باطل کردن فاکتور",
    voidConfirm:      "این فاکتور باطل شود؟ این عملیات قابل بازگشت نیست.",
    insuranceClaim: {
      title:           "ادعای بیمه",
      new:             "ثبت ادعای بیمه",
      provider:        "بیمه‌گر",
      policyNumber:    "شماره بیمه‌نامه",
      claimedAmount:   "مبلغ ادعا شده",
      approvedAmount:  "مبلغ تأییدشده",
      rejectionReason: "دلیل رد",
      updateStatus:    "بروزرسانی وضعیت",
      status: { draft: "پیش‌نویس", submitted: "ارسال‌شده", approved: "تأییدشده", rejected: "ردشده", paid: "پرداخت‌شده" },
    },
    outstandingWarning: "مبلغ وارد شده بیشتر از باقی‌مانده فاکتور است",
    noInvoices:         "فاکتوری ثبت نشده",
    createInvoice:      "ثبت فاکتور",
    addPayment:         "ثبت پرداخت",
  },

  // ─── انبار (ماژول Inventory) ────────────────────────────────
  inventory: {
    title:          "انبار",
    new:            "قلم جدید",
    sku:            "کد کالا",
    name:           "نام کالا",
    unit:           "واحد",
    quantityOnHand: "موجودی",
    reorderLevel:   "حد سفارش مجدد",
    batchNumber:    "شماره بچ",
    expiryDate:     "تاریخ انقضا",
    lowStock:       "موجودی کم",
    lowStockOnly:   "فقط موجودی کم",
    adjust:         "تعدیل موجودی",
    adjustment: {
      type:          "نوع تراکنش",
      quantityDelta: "مقدار تغییر (+/-)",
      reference:     "مرجع",
      notes:         "یادداشت",
      types: {
        openingBalance: "موجودی اولیه",
        purchase:       "خرید",
        consumption:    "مصرف",
        adjustment:     "تعدیل",
        return:         "مرجوعی",
      },
    },
    transactions:  "تراکنش‌ها",
    balanceAfter:  "موجودی پس از تراکنش",
    noItems:       "کالایی ثبت نشده",
    branch:        "شعبه",
    allBranches:   "همه شعبه‌ها",
  },

  // ─── صف پذیرش حضوری (ماژول VisitQueue) ──────────────────────
  visitQueue: {
    title:              "صف پذیرش",
    checkIn:             "پذیرش",
    queueNumber:         "شماره نوبت",
    checkedInAt:         "زمان پذیرش",
    calledAt:            "زمان فراخوان",
    startedAt:           "زمان شروع ویزیت",
    completedAt:         "زمان پایان",
    call:                "فراخوان",
    startVisit:          "شروع ویزیت",
    complete:            "پایان ویزیت",
    noShow:              "غایب",
    cancel:              "لغو",
    status: {
      checkedIn: "پذیرش‌شده",
      waiting:   "در انتظار",
      called:    "فراخوانده‌شده",
      inVisit:   "در حال ویزیت",
      completed: "پایان‌یافته",
      noShow:    "غایب",
      cancelled: "لغوشده",
    },
    empty:               "صف امروز خالی است",
    selectAppointment:   "انتخاب نوبت برای پذیرش",
    todaysAppointments:  "نوبت‌های امروز",
  },

  // ─── فایل‌های پیوست پزشکی (ماژول MedicalFiles) ──────────────
  medicalFile: {
    title:        "فایل‌های پیوست",
    upload:       "بارگذاری فایل",
    download:     "دانلود",
    delete:       "حذف",
    description:  "توضیح",
    noFiles:      "فایلی پیوست نشده",
    uploading:    "در حال بارگذاری...",
    allowedTypes: "فقط PDF، JPG و PNG — حداکثر ۱۰ مگابایت",
  },

  // ─── یکپارچه‌سازی‌ها: تقویم و ویزیت آنلاین (ماژول Integrations) ──
  integration: {
    exportCalendar: "دانلود تقویم (.ics)",
    createSession:  "ایجاد جلسه ویزیت آنلاین",
    joinUrl:        "لینک جلسه",
    copyLink:       "کپی لینک",
    linkCopied:     "لینک کپی شد",
    sessionCreated: "جلسه ایجاد شد",
    notConfigured:  "سرویس ویزیت آنلاین پیکربندی نشده است",
  },
};
