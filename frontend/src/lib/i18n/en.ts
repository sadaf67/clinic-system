// ══════════════════════════════════════════════════════════════
// English translations file
// This file is the English "dictionary" of the app.
// Every key here mirrors the Persian fa.ts file exactly —
// same structure, same keys, different text values.
// When lang = "en", these strings are shown.
// ══════════════════════════════════════════════════════════════
export const en = {

  // General words used everywhere
  common: {
    save:     "Save",
    cancel:   "Cancel",
    delete:   "Delete",
    edit:     "Edit",
    search:   "Search",
    loading:  "Loading...",
    noData:   "No data found",
    confirm:  "Confirm",
    back:     "Back",
    next:     "Next",
    prev:     "Previous",
    yes:      "Yes",
    no:       "No",
    submit:   "Submit",
    close:    "Close",
    details:  "Details",
    actions:  "Actions",
    status:   "Status",
    date:     "Date",
    time:     "Time",
    name:     "Name",
    phone:    "Mobile",
    total:    "Total",
  },

  // Login / logout / account-related
  auth: {
    login:           "Login",
    logout:          "Logout",
    register:        "Register",
    username:        "Username / Mobile",
    password:        "Password",
    newPassword:     "New Password",
    currentPassword: "Current Password",
    confirmPassword: "Confirm Password",
    forgotPassword:  "Forgot Password",
    changePassword:  "Change Password",
    loginTitle:      "Sign In",
    welcome:         "Welcome",
  },

  // Page names shown in the sidebar navigation
  nav: {
    dashboard:     "Dashboard",
    patients:      "Patients",
    appointments:  "Appointments",
    medicalRecords:"Medical Records",
    prescriptions: "Prescriptions",
    consultations: "Online Consultations",
    reports:       "Reports",
    settings:      "Settings",
    users:         "Users",
    auditLog:      "Activity Log",
    notifications: "Notifications",
    profile:       "Profile",
    myPanel:       "My Panel",
    visitQueue:    "Visit Queue",
    billing:       "Billing",
    inventory:     "Inventory",
  },

  // Dashboard page text
  dashboard: {
    title:                "Dashboard",
    totalPatients:        "Total Patients",
    todayAppointments:    "Today's Appointments",
    pendingAppointments:  "Pending Appointments",
    pendingConsultations: "Pending Consultations",
    newPatientsMonth:     "New Patients This Month",
    completedVisitsMonth: "Completed Visits This Month",
    upcomingToday:        "Upcoming Today",
    weeklyChart:          "Weekly Appointments Chart",
    monthlyChart:         "Monthly New Patients",
  },

  // Appointment-related text
  appointment: {
    title:          "Appointments",
    new:            "New Appointment",
    date:           "Date",
    time:           "Time",
    type:           "Type",
    inPerson:       "In-Person",  // face-to-face visit
    online:         "Online",     // video call visit
    status: {
      pending:   "Pending",    // waiting for doctor confirmation
      confirmed: "Confirmed",  // doctor confirmed
      cancelled: "Cancelled",
      completed: "Completed",  // visit done
      noShow:    "No Show",    // patient didn't show up
    },
    chiefComplaint:  "Chief Complaint",  // reason for visit
    notes:           "Notes",
    meetingLink:     "Meeting Link",     // for online visits
    reminder:        "Reminder",
    availableSlots:  "Available Slots",  // open time slots
    bookAppointment: "Book Appointment",
  },

  // Patient-related text
  patient: {
    title:            "Patients",
    new:              "New Patient",
    nationalCode:     "National ID",
    dateOfBirth:      "Date of Birth",
    age:              "Age",
    gender:           { male: "Male", female: "Female", other: "Other" },
    bloodType:        "Blood Type",
    address:          "Address",
    insurance:        "Insurance",
    allergies:        "Allergies",          // drug or food allergies
    chronicDiseases:  "Chronic Diseases",  // e.g. diabetes, hypertension
    medications:      "Current Medications",
    familyHistory:    "Family History",
    emergency:        "Emergency Contact",  // who to call in emergency
    medicalHistory:   "Medical History",
    vitalSigns:       "Vital Signs",       // weight, BP, pulse, temp…
    progress:         "Progress / Trends",
    weight:           "Weight",
    bloodPressure:    "Blood Pressure",
    bloodSugar:       "Blood Sugar",
    heartRate:        "Heart Rate",
    temperature:      "Temperature",
    oxygenSaturation: "O₂ Saturation",    // SpO2
    bmi:              "BMI",
    trends: {
      up:     "Increasing",  // going up
      down:   "Decreasing",  // going down
      stable: "Stable",      // no significant change
    },
  },

  // Prescription-related text
  prescription: {
    title:       "Prescriptions",
    new:         "New Prescription",
    medicine:    "Medicine",
    dosage:      "Dosage",       // e.g. 500mg
    frequency:   "Frequency",   // e.g. 3 times/day
    duration:    "Duration",    // e.g. 7 days
    instructions:"Instructions",
    quantity:    "Quantity",
    issuedDate:  "Issued Date",
    expiryDate:  "Expiry Date",
    code:        "Prescription Code",  // e.g. RX-20240615-A3F2
    status: {
      active:    "Active",     // still valid
      expired:   "Expired",   // past expiry date
      cancelled: "Cancelled",
    },
  },

  // Online consultation text
  consultation: {
    title:   "Online Consultations",
    new:     "New Consultation",
    question:"Patient Question",
    answer:  "Doctor Answer",
    urgent:  "Urgent",
    status: {
      waiting:    "Waiting",      // waiting for doctor to answer
      inProgress: "In Progress",  // doctor is reviewing
      completed:  "Answered",     // doctor replied
      cancelled:  "Cancelled",
    },
    chat: "Chat",
    send: "Send Message",
  },

  // Notification text
  notifications: {
    title:               "Notifications",
    markAllRead:         "Mark all as read",
    noNotifications:     "No notifications",
    appointmentReminder: "Appointment Reminder",
    appointmentConfirmed:"Appointment Confirmed",
    consultationReply:   "Consultation Reply",
  },

  // Billing / invoices module
  billing: {
    title:            "Invoices",
    new:              "New Invoice",
    invoiceNumber:    "Invoice #",
    patient:          "Patient",
    issuedAt:         "Issued",
    dueAt:            "Due date",
    subtotal:         "Subtotal",
    discount:         "Discount",
    insuranceAmount:  "Insurance",
    total:            "Total",
    paid:             "Paid",
    outstanding:      "Outstanding",
    notes:            "Notes",
    items:            "Invoice Items",
    addItem:          "Add Item",
    description:      "Description",
    quantity:         "Qty",
    unitPrice:        "Unit Price",
    lineTotal:        "Line Total",
    status: {
      draft:         "Draft",
      issued:        "Issued",
      partiallyPaid: "Partially Paid",
      paid:          "Paid",
      void:          "Void",
    },
    payment: {
      title:     "Payments",
      add:       "Add Payment",
      amount:    "Amount",
      method:    "Method",
      reference: "Reference",
      methods: { cash: "Cash", card: "Card", transfer: "Transfer", manual: "Manual" },
      status: { pending: "Pending", succeeded: "Succeeded", failed: "Failed", refunded: "Refunded" },
    },
    void:             "Void Invoice",
    voidConfirm:      "Void this invoice? This cannot be undone.",
    insuranceClaim: {
      title:           "Insurance Claim",
      new:             "New Insurance Claim",
      provider:        "Provider",
      policyNumber:    "Policy Number",
      claimedAmount:   "Claimed Amount",
      approvedAmount:  "Approved Amount",
      rejectionReason: "Rejection Reason",
      updateStatus:    "Update Status",
      status: { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", paid: "Paid" },
    },
    outstandingWarning: "Amount exceeds the invoice's outstanding balance",
    noInvoices:         "No invoices yet",
    createInvoice:      "Create Invoice",
    addPayment:         "Add Payment",
  },

  // Inventory module
  inventory: {
    title:          "Inventory",
    new:            "New Item",
    sku:            "SKU",
    name:           "Item Name",
    unit:           "Unit",
    quantityOnHand: "On Hand",
    reorderLevel:   "Reorder Level",
    batchNumber:    "Batch #",
    expiryDate:     "Expiry Date",
    lowStock:       "Low Stock",
    lowStockOnly:   "Low stock only",
    adjust:         "Adjust Stock",
    adjustment: {
      type:          "Transaction Type",
      quantityDelta: "Quantity Change (+/-)",
      reference:     "Reference",
      notes:         "Notes",
      types: {
        openingBalance: "Opening Balance",
        purchase:       "Purchase",
        consumption:    "Consumption",
        adjustment:     "Adjustment",
        return:         "Return",
      },
    },
    transactions: "Transactions",
    balanceAfter: "Balance After",
    noItems:      "No items yet",
    branch:       "Branch",
    allBranches:  "All branches",
  },

  // Front-desk visit queue module
  visitQueue: {
    title:              "Visit Queue",
    checkIn:             "Check In",
    queueNumber:         "Queue #",
    checkedInAt:         "Checked In",
    calledAt:            "Called At",
    startedAt:           "Started At",
    completedAt:         "Completed At",
    call:                "Call",
    startVisit:          "Start Visit",
    complete:            "Complete",
    noShow:              "No Show",
    cancel:              "Cancel",
    status: {
      checkedIn: "Checked In",
      waiting:   "Waiting",
      called:    "Called",
      inVisit:   "In Visit",
      completed: "Completed",
      noShow:    "No Show",
      cancelled: "Cancelled",
    },
    empty:               "Today's queue is empty",
    selectAppointment:   "Select appointment to check in",
    todaysAppointments:  "Today's Appointments",
  },

  // Medical file attachments module
  medicalFile: {
    title:        "Attached Files",
    upload:       "Upload File",
    download:     "Download",
    delete:       "Delete",
    description:  "Description",
    noFiles:      "No files attached",
    uploading:    "Uploading...",
    allowedTypes: "PDF, JPG and PNG only — max 10 MB",
  },

  // Calendar export / telemedicine integrations module
  integration: {
    exportCalendar: "Download Calendar (.ics)",
    createSession:  "Create Telemedicine Session",
    joinUrl:        "Join Link",
    copyLink:       "Copy Link",
    linkCopied:     "Link copied",
    sessionCreated: "Session created",
    notConfigured:  "Telemedicine provider is not configured",
  },
};
