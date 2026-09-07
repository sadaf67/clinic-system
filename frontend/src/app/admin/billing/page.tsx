"use client";

// ══════════════════════════════════════════════════════════════
// صفحه صورتحساب‌ها (Billing) — فقط برای پزشک/منشی (SuperAdmin/Admin)
//
// این صفحه از کنترلر بک‌اندی BillingController استفاده می‌کنه که
// از قبل کاملاً پیاده‌سازی شده بود ولی هیچ رابط کاربری‌ای نداشت.
//
// قابلیت‌ها:
// - لیست فاکتورها + فیلتر وضعیت/جستجو
// - صدور فاکتور جدید (با اقلام دینامیک)
// - باز کردن جزئیات فاکتور: اقلام، پرداخت‌ها
// - ثبت پرداخت جدید روی فاکتور
// - باطل کردن فاکتور (فقط پزشک/SuperAdmin)
// - ثبت ادعای بیمه + بروزرسانی وضعیتش
//   (توجه: بک‌اند برای ادعاهای بیمه فقط create/update-status داره،
//   نه لیست/GET؛ پس ادعای ثبت‌شده فقط تا وقتی صفحه باز نشده دوباره
//   قابل مشاهده‌ست — این محدودیت بک‌اند است، نه باگ فرانت)
// ══════════════════════════════════════════════════════════════
import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { billingApi, patientApi } from "@/lib/api/axios";
import NewInvoiceModal from "@/components/forms/NewInvoiceModal";
import {
  Receipt, Plus, ChevronDown, Search, ShieldAlert, Ban, CreditCard, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: number; }
interface InvoicePayment { id: string; amount: number; method: string; status: string; paidAt?: string | null; gatewayReference?: string | null; }
interface Invoice {
  id: string; number: string; patientId: string; appointmentId?: string | null; branchId?: string | null;
  status: string; issuedAt: string; dueAt?: string | null;
  discountAmount: number; insuranceAmount: number; currency: string; notes?: string | null;
  subtotal: number; total: number; paidAmount: number; outstandingAmount: number;
  items: InvoiceItem[]; payments: InvoicePayment[];
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  Draft: "badge-gray", Issued: "badge-blue", PartiallyPaid: "badge-yellow", Paid: "badge-green", Void: "badge-red",
};
const PAYMENT_STATUS_BADGE: Record<string, string> = {
  Pending: "badge-yellow", Succeeded: "badge-green", Failed: "badge-red", Refunded: "badge-gray",
};
const CLAIM_STATUS_BADGE: Record<string, string> = {
  Draft: "badge-gray", Submitted: "badge-blue", Approved: "badge-green", Rejected: "badge-red", Paid: "badge-green",
};

const PAYMENT_METHODS = ["Cash", "Card", "Transfer", "Manual"] as const;
const CLAIM_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Paid"] as const;

export default function BillingPage() {
  const { lang } = useAppStore();
  const { user } = useAuthStore();
  const t = useTranslations(lang);
  const fa = lang === "fa";
  const isSuperAdmin = user?.role === "SuperAdmin";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ─── فرم پرداخت جدید (به ازای هر فاکتور) ────────────────────
  const [paymentForm, setPaymentForm] = useState<Record<string, { amount: string; method: string; reference: string }>>({});
  const [addingPayment, setAddingPayment] = useState<Record<string, boolean>>({});
  const [voiding, setVoiding] = useState<Record<string, boolean>>({});

  // ─── فرم ادعای بیمه (فقط ثبت؛ بک‌اند GET نداره) ─────────────
  const [claimForm, setClaimForm] = useState<Record<string, { provider: string; policyNumber: string; claimedAmount: string }>>({});
  const [creatingClaim, setCreatingClaim] = useState<Record<string, boolean>>({});
  const [localClaims, setLocalClaims] = useState<Record<string, { id: string; claimNumber: string; status: string; claimedAmount: number; approvedAmount?: number; rejectionReason?: string }>>({});
  const [claimStatusForm, setClaimStatusForm] = useState<Record<string, { status: string; approvedAmount: string; rejectionReason: string }>>({});
  const [updatingClaim, setUpdatingClaim] = useState<Record<string, boolean>>({});

  const loadInvoices = () => {
    setLoading(true);
    billingApi.getInvoices({})
      .then(({ data }) => { setInvoices(data || []); setForbidden(false); })
      .catch((err) => {
        setInvoices([]);
        if (err?.response?.status === 403) setForbidden(true);
        else toast.error(fa ? "دریافت فاکتورها ناموفق بود" : "Could not load invoices");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === "Patient") return; // این صفحه فقط برای کادر درمانه
    loadInvoices();
    patientApi.getAll({ page: 1, pageSize: 200 })
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data?.items || []).forEach((p: any) => { map[p.id] = p.fullName; });
        setPatientNames(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const patientLabel = (id: string) => patientNames[id] || (fa ? "بیمار نامشخص" : "Unknown patient");
  const statusLabel = (s: string) => (t.billing.status as any)[s.charAt(0).toLowerCase() + s.slice(1)] || s;

  const q = search.trim().toLowerCase();
  const filtered = invoices.filter(inv => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (!q) return true;
    return inv.number?.toLowerCase().includes(q) || patientLabel(inv.patientId).toLowerCase().includes(q);
  });

  const money = (n: number, currency: string) => `${n.toLocaleString(fa ? "fa-IR" : "en-US")} ${currency || ""}`.trim();

  // ─── ثبت پرداخت جدید ─────────────────────────────────────────
  const submitPayment = async (invoice: Invoice) => {
    const form = paymentForm[invoice.id] || { amount: "", method: "Cash", reference: "" };
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error(fa ? "مبلغ پرداخت باید بزرگ‌تر از صفر باشد" : "Payment amount must be greater than zero");
      return;
    }
    if (amount > invoice.outstandingAmount) {
      toast.error(t.billing.outstandingWarning);
      return;
    }
    setAddingPayment(prev => ({ ...prev, [invoice.id]: true }));
    try {
      const idempotencyKey = (crypto as any)?.randomUUID ? crypto.randomUUID() : `${invoice.id}-${Date.now()}`;
      await billingApi.addPayment(invoice.id, {
        amount, method: form.method, idempotencyKey, reference: form.reference.trim() || null,
      });
      toast.success(fa ? "پرداخت ثبت شد" : "Payment recorded");
      setPaymentForm(prev => ({ ...prev, [invoice.id]: { amount: "", method: "Cash", reference: "" } }));
      loadInvoices();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "ثبت پرداخت ناموفق بود" : "Could not record payment"));
    } finally {
      setAddingPayment(prev => ({ ...prev, [invoice.id]: false }));
    }
  };

  // ─── باطل کردن فاکتور ────────────────────────────────────────
  const voidInvoice = async (invoice: Invoice) => {
    if (!window.confirm(t.billing.voidConfirm)) return;
    setVoiding(prev => ({ ...prev, [invoice.id]: true }));
    try {
      await billingApi.voidInvoice(invoice.id);
      toast.success(fa ? "فاکتور باطل شد" : "Invoice voided");
      loadInvoices();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "باطل کردن ناموفق بود" : "Could not void invoice"));
    } finally {
      setVoiding(prev => ({ ...prev, [invoice.id]: false }));
    }
  };

  // ─── ثبت ادعای بیمه ──────────────────────────────────────────
  const submitClaim = async (invoice: Invoice) => {
    const form = claimForm[invoice.id] || { provider: "", policyNumber: "", claimedAmount: "" };
    const claimedAmount = Number(form.claimedAmount);
    if (!form.provider.trim() || !form.policyNumber.trim() || !claimedAmount || claimedAmount <= 0) {
      toast.error(fa ? "اطلاعات ادعای بیمه ناقص است" : "Insurance claim details are incomplete");
      return;
    }
    setCreatingClaim(prev => ({ ...prev, [invoice.id]: true }));
    try {
      const { data } = await billingApi.createClaim(invoice.id, {
        provider: form.provider.trim(), policyNumber: form.policyNumber.trim(), claimedAmount,
      });
      setLocalClaims(prev => ({ ...prev, [invoice.id]: { id: data.id, claimNumber: data.claimNumber, status: data.status, claimedAmount } }));
      setClaimStatusForm(prev => ({ ...prev, [invoice.id]: { status: data.status, approvedAmount: "", rejectionReason: "" } }));
      toast.success(fa ? "ادعای بیمه ثبت شد" : "Insurance claim created");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "ثبت ادعای بیمه ناموفق بود" : "Could not create insurance claim"));
    } finally {
      setCreatingClaim(prev => ({ ...prev, [invoice.id]: false }));
    }
  };

  // ─── بروزرسانی وضعیت ادعای بیمه ─────────────────────────────
  const updateClaimStatus = async (invoice: Invoice) => {
    const claim = localClaims[invoice.id];
    if (!claim) return;
    const form = claimStatusForm[invoice.id] || { status: claim.status, approvedAmount: "", rejectionReason: "" };
    setUpdatingClaim(prev => ({ ...prev, [invoice.id]: true }));
    try {
      const { data } = await billingApi.updateClaimStatus(claim.id, {
        status: form.status,
        approvedAmount: form.approvedAmount ? Number(form.approvedAmount) : null,
        rejectionReason: form.rejectionReason.trim() || null,
      });
      setLocalClaims(prev => ({ ...prev, [invoice.id]: { ...claim, status: data.status, approvedAmount: data.approvedAmount } }));
      toast.success(fa ? "وضعیت ادعای بیمه بروزرسانی شد" : "Insurance claim status updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "بروزرسانی ناموفق بود" : "Could not update status"));
    } finally {
      setUpdatingClaim(prev => ({ ...prev, [invoice.id]: false }));
    }
  };

  if (user?.role === "Patient" || forbidden) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <p className="text-gray-900 font-semibold">{fa ? "دسترسی محدود شده" : "Access restricted"}</p>
        <p className="text-gray-500 text-sm mt-1">
          {fa ? "این صفحه فقط برای کادر درمان قابل مشاهده است" : "This page is only visible to clinic staff"}
        </p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ─── عنوان ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              {t.billing.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {fa ? `${invoices.length.toLocaleString("fa-IR")} فاکتور ثبت شده` : `${invoices.length} invoices on record`}
            </p>
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus className="w-4 h-4" />
            {t.billing.createInvoice}
          </button>
        </div>

        {/* ─── فیلترها ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={fa ? "جستجو با شماره فاکتور یا نام بیمار..." : "Search by invoice number or patient..."}
              className="input-field ps-11" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field sm:max-w-[220px]">
            <option value="">{fa ? "همه وضعیت‌ها" : "All statuses"}</option>
            {Object.keys(INVOICE_STATUS_BADGE).map(s => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>

        {/* ─── جدول فاکتورها ───────────────────────────────────── */}
        <div className="card !p-0 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">{t.billing.noInvoices}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{t.billing.invoiceNumber}</th>
                    <th className="text-start">{t.billing.patient}</th>
                    <th className="text-start">{t.billing.issuedAt}</th>
                    <th className="text-start">{t.billing.total}</th>
                    <th className="text-start">{t.billing.paid}</th>
                    <th className="text-start">{t.billing.outstanding}</th>
                    <th className="text-start">{t.common.status}</th>
                    <th className="text-start"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const isOpen = expanded === inv.id;
                    const pf = paymentForm[inv.id] || { amount: "", method: "Cash", reference: "" };
                    const cf = claimForm[inv.id] || { provider: "", policyNumber: "", claimedAmount: "" };
                    const claim = localClaims[inv.id];
                    const csf = claimStatusForm[inv.id] || { status: claim?.status || "Draft", approvedAmount: "", rejectionReason: "" };
                    const canPay = inv.status !== "Void" && inv.status !== "Paid";
                    const canVoid = isSuperAdmin && inv.status !== "Void" && !inv.payments.some(p => p.status === "Succeeded");

                    return (
                      <React.Fragment key={inv.id}>
                        <tr onClick={() => setExpanded(isOpen ? null : inv.id)} className="cursor-pointer">
                          <td className="font-medium text-gray-900" dir="ltr">{inv.number}</td>
                          <td className="text-gray-700">{patientLabel(inv.patientId)}</td>
                          <td className="text-gray-500 text-xs whitespace-nowrap" dir="ltr">
                            {new Date(inv.issuedAt).toLocaleDateString(fa ? "fa-IR" : "en-US")}
                          </td>
                          <td className="text-gray-900" dir="ltr">{money(inv.total, inv.currency)}</td>
                          <td className="text-green-600" dir="ltr">{money(inv.paidAmount, inv.currency)}</td>
                          <td className="text-amber-600" dir="ltr">{money(inv.outstandingAmount, inv.currency)}</td>
                          <td>
                            <span className={`badge ${INVOICE_STATUS_BADGE[inv.status] || "badge-gray"}`}>
                              {statusLabel(inv.status)}
                            </span>
                          </td>
                          <td>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="bg-gray-50/70 !py-4">
                              <div className="grid md:grid-cols-2 gap-5" onClick={e => e.stopPropagation()}>

                                {/* ─── اقلام فاکتور ───────────────────── */}
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 mb-2">{t.billing.items}</div>
                                  <div className="space-y-1.5">
                                    {inv.items.map(it => (
                                      <div key={it.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                        <span className="text-gray-700 truncate">{it.description}</span>
                                        <span className="text-gray-500 shrink-0" dir="ltr">{it.quantity} × {it.unitPrice.toLocaleString(fa ? "fa-IR" : "en-US")}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {inv.notes && <div className="text-xs text-gray-400 mt-2">{t.billing.notes}: {inv.notes}</div>}

                                  {/* ─── ادعای بیمه ─────────────────────── */}
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      {t.billing.insuranceClaim.title}
                                    </div>
                                    {claim ? (
                                      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-700" dir="ltr">{claim.claimNumber}</span>
                                          <span className={`badge ${CLAIM_STATUS_BADGE[claim.status] || "badge-gray"}`}>
                                            {(t.billing.insuranceClaim.status as any)[claim.status.charAt(0).toLowerCase() + claim.status.slice(1)] || claim.status}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <select value={csf.status} onChange={e => setClaimStatusForm(prev => ({ ...prev, [inv.id]: { ...csf, status: e.target.value } }))} className="input-field text-xs !py-1.5">
                                            {CLAIM_STATUSES.map(s => (
                                              <option key={s} value={s}>{(t.billing.insuranceClaim.status as any)[s.charAt(0).toLowerCase() + s.slice(1)]}</option>
                                            ))}
                                          </select>
                                          <input type="number" min={0} placeholder={t.billing.insuranceClaim.approvedAmount}
                                            value={csf.approvedAmount} onChange={e => setClaimStatusForm(prev => ({ ...prev, [inv.id]: { ...csf, approvedAmount: e.target.value } }))}
                                            className="input-field text-xs !py-1.5" />
                                        </div>
                                        {csf.status === "Rejected" && (
                                          <input value={csf.rejectionReason} placeholder={t.billing.insuranceClaim.rejectionReason}
                                            onChange={e => setClaimStatusForm(prev => ({ ...prev, [inv.id]: { ...csf, rejectionReason: e.target.value } }))}
                                            className="input-field text-xs !py-1.5 w-full" />
                                        )}
                                        <button onClick={() => updateClaimStatus(inv)} disabled={updatingClaim[inv.id]}
                                          className="btn-secondary text-xs !py-1.5 w-full disabled:opacity-60">
                                          {t.billing.insuranceClaim.updateStatus}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                                        <input placeholder={t.billing.insuranceClaim.provider} value={cf.provider}
                                          onChange={e => setClaimForm(prev => ({ ...prev, [inv.id]: { ...cf, provider: e.target.value } }))}
                                          className="input-field text-xs !py-1.5" />
                                        <div className="grid grid-cols-2 gap-2">
                                          <input placeholder={t.billing.insuranceClaim.policyNumber} value={cf.policyNumber}
                                            onChange={e => setClaimForm(prev => ({ ...prev, [inv.id]: { ...cf, policyNumber: e.target.value } }))}
                                            className="input-field text-xs !py-1.5" />
                                          <input type="number" min={0} placeholder={t.billing.insuranceClaim.claimedAmount} value={cf.claimedAmount}
                                            onChange={e => setClaimForm(prev => ({ ...prev, [inv.id]: { ...cf, claimedAmount: e.target.value } }))}
                                            className="input-field text-xs !py-1.5" />
                                        </div>
                                        <button onClick={() => submitClaim(inv)} disabled={creatingClaim[inv.id]}
                                          className="btn-secondary text-xs !py-1.5 w-full disabled:opacity-60">
                                          {t.billing.insuranceClaim.new}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* ─── پرداخت‌ها ──────────────────────── */}
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5" />
                                    {t.billing.payment.title}
                                  </div>
                                  <div className="space-y-1.5">
                                    {inv.payments.length === 0 && (
                                      <div className="text-xs text-gray-400">{fa ? "پرداختی ثبت نشده" : "No payments yet"}</div>
                                    )}
                                    {inv.payments.map(p => (
                                      <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                        <span className="text-gray-700" dir="ltr">{money(p.amount, inv.currency)}</span>
                                        <span className="text-gray-500">{(t.billing.payment.methods as any)[p.method?.charAt(0).toLowerCase() + p.method?.slice(1)] || p.method}</span>
                                        <span className={`badge ${PAYMENT_STATUS_BADGE[p.status] || "badge-gray"}`}>
                                          {(t.billing.payment.status as any)[p.status.charAt(0).toLowerCase() + p.status.slice(1)] || p.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {canPay && (
                                    <div className="mt-3 bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <input type="number" min={0} placeholder={t.billing.payment.amount} value={pf.amount}
                                          onChange={e => setPaymentForm(prev => ({ ...prev, [inv.id]: { ...pf, amount: e.target.value } }))}
                                          className="input-field text-xs !py-1.5" />
                                        <select value={pf.method} onChange={e => setPaymentForm(prev => ({ ...prev, [inv.id]: { ...pf, method: e.target.value } }))}
                                          className="input-field text-xs !py-1.5">
                                          {PAYMENT_METHODS.map(m => (
                                            <option key={m} value={m}>{(t.billing.payment.methods as any)[m.toLowerCase()]}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <input placeholder={t.billing.payment.reference} value={pf.reference}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, [inv.id]: { ...pf, reference: e.target.value } }))}
                                        className="input-field text-xs !py-1.5 w-full" />
                                      <button onClick={() => submitPayment(inv)} disabled={addingPayment[inv.id]}
                                        className="btn-primary text-xs !py-1.5 w-full disabled:opacity-60">
                                        {t.billing.payment.add}
                                      </button>
                                    </div>
                                  )}

                                  {canVoid && (
                                    <button onClick={() => voidInvoice(inv)} disabled={voiding[inv.id]}
                                      className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-60">
                                      <Ban className="w-3.5 h-3.5" />
                                      {t.billing.void}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewInvoiceModal
          lang={lang}
          t={t}
          onClose={() => setShowNewModal(false)}
          onSaved={loadInvoices}
        />
      )}
    </AdminLayout>
  );
}
