"use client";

// ══════════════════════════════════════════════════════════════
// صفحه انبار (Inventory) — فقط برای پزشک/منشی (SuperAdmin/Admin)
//
// از کنترلر بک‌اندی InventoryController استفاده می‌کنه که از قبل
// کاملاً پیاده‌سازی شده بود (شامل تراکنش سریالایز برای جلوگیری از
// رقابت هم‌زمان روی موجودی) ولی هیچ رابط کاربری‌ای نداشت.
//
// قابلیت‌ها:
// - لیست اقلام انبار + فیلتر شعبه/فقط‌کم‌موجودی + جستجو
// - افزودن قلم جدید
// - تعدیل موجودی (خرید/مصرف/مرجوعی/...) با فرم درون‌خطی
// - مشاهده تاریخچه تراکنش‌های هر قلم (واکشی تنبل هنگام باز کردن ردیف)
// ══════════════════════════════════════════════════════════════
import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore, useAuthStore } from "@/store/useStore";
import { useTranslations } from "@/lib/i18n";
import { inventoryApi, branchApi } from "@/lib/api/axios";
import NewInventoryItemModal from "@/components/forms/NewInventoryItemModal";
import { Package, Plus, ChevronDown, Search, ShieldAlert, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface InventoryItemRow {
  id: string; branchId?: string | null; sku: string; name: string; unit: string;
  quantityOnHand: number; reorderLevel: number; batchNumber?: string | null;
  expiryDate?: string | null; isActive: boolean; lowStock: boolean;
}
interface InventoryTransaction {
  id: string; type: string; quantityDelta: number; balanceAfter: number;
  performedByUserId?: string | null; reference?: string | null; notes?: string | null; createdAt: string;
}

const TX_TYPES = ["OpeningBalance", "Purchase", "Consumption", "Adjustment", "Return"] as const;

export default function InventoryPage() {
  const { lang } = useAppStore();
  const { user } = useAuthStore();
  const t = useTranslations(lang);
  const fa = lang === "fa";

  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Record<string, InventoryTransaction[]>>({});
  const [loadingTx, setLoadingTx] = useState<Record<string, boolean>>({});
  const [adjustForm, setAdjustForm] = useState<Record<string, { type: string; quantityDelta: string; reference: string; notes: string }>>({});
  const [adjusting, setAdjusting] = useState<Record<string, boolean>>({});

  const branchName = (id?: string | null) => branches.find(b => b.id === id)?.name || (fa ? "بدون شعبه" : "No branch");

  const loadItems = () => {
    setLoading(true);
    inventoryApi.getAll({ branchId: branchFilter || undefined, lowStockOnly: lowStockOnly || undefined })
      .then(({ data }) => { setItems(data || []); setForbidden(false); })
      .catch((err) => {
        setItems([]);
        if (err?.response?.status === 403) setForbidden(true);
        else toast.error(fa ? "دریافت انبار ناموفق بود" : "Could not load inventory");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === "Patient") return;
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, lowStockOnly, user?.role]);

  useEffect(() => {
    branchApi.getAll().then(({ data }) => setBranches(data || [])).catch(() => {});
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(it =>
    !q || it.sku?.toLowerCase().includes(q) || it.name?.toLowerCase().includes(q));

  const toggleExpand = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !transactions[id]) {
      setLoadingTx(prev => ({ ...prev, [id]: true }));
      inventoryApi.getTransactions(id)
        .then(({ data }) => setTransactions(prev => ({ ...prev, [id]: data || [] })))
        .catch(() => toast.error(fa ? "دریافت تراکنش‌ها ناموفق بود" : "Could not load transactions"))
        .finally(() => setLoadingTx(prev => ({ ...prev, [id]: false })));
    }
  };

  const submitAdjust = async (item: InventoryItemRow) => {
    const form = adjustForm[item.id] || { type: "Adjustment", quantityDelta: "", reference: "", notes: "" };
    const delta = Number(form.quantityDelta);
    if (!delta) {
      toast.error(fa ? "مقدار تغییر نمی‌تواند صفر باشد" : "Quantity change cannot be zero");
      return;
    }
    setAdjusting(prev => ({ ...prev, [item.id]: true }));
    try {
      await inventoryApi.adjust(item.id, {
        type: form.type, quantityDelta: delta,
        reference: form.reference.trim() || null, notes: form.notes.trim() || null,
      });
      toast.success(fa ? "موجودی بروزرسانی شد" : "Stock updated");
      setAdjustForm(prev => ({ ...prev, [item.id]: { type: "Adjustment", quantityDelta: "", reference: "", notes: "" } }));
      loadItems();
      // تاریخچه تراکنش رو هم رفرش کن اگه باز بود
      inventoryApi.getTransactions(item.id).then(({ data }) => setTransactions(prev => ({ ...prev, [item.id]: data || [] }))).catch(() => {});
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "تعدیل ناموفق بود" : "Could not adjust stock"));
    } finally {
      setAdjusting(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const txTypeLabel = (type: string) => (t.inventory.adjustment.types as any)[type.charAt(0).toLowerCase() + type.slice(1)] || type;

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
              <Package className="w-6 h-6 text-blue-600" />
              {t.inventory.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {fa ? `${items.length.toLocaleString("fa-IR")} قلم ثبت شده` : `${items.length} items on record`}
            </p>
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus className="w-4 h-4" />
            {t.inventory.new}
          </button>
        </div>

        {/* ─── فیلترها ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-4 h-4 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={fa ? "جستجو با کد یا نام کالا..." : "Search by SKU or name..."}
              className="input-field ps-11" />
          </div>
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="input-field sm:max-w-[220px]">
            <option value="">{t.inventory.allBranches}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 px-3 whitespace-nowrap">
            <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded border-gray-300" />
            {t.inventory.lowStockOnly}
          </label>
        </div>

        {/* ─── جدول اقلام انبار ────────────────────────────────── */}
        <div className="card !p-0 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">{t.inventory.noItems}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{t.inventory.sku}</th>
                    <th className="text-start">{t.inventory.name}</th>
                    <th className="text-start">{t.inventory.branch}</th>
                    <th className="text-start">{t.inventory.quantityOnHand}</th>
                    <th className="text-start">{t.inventory.reorderLevel}</th>
                    <th className="text-start">{t.common.status}</th>
                    <th className="text-start"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isOpen = expanded === item.id;
                    const af = adjustForm[item.id] || { type: "Adjustment", quantityDelta: "", reference: "", notes: "" };
                    const txs = transactions[item.id] || [];

                    return (
                      <React.Fragment key={item.id}>
                        <tr onClick={() => toggleExpand(item.id)} className="cursor-pointer">
                          <td className="font-medium text-gray-900" dir="ltr">{item.sku}</td>
                          <td className="text-gray-700">
                            {item.name}
                            {item.batchNumber && <span className="text-gray-400 text-xs ms-1.5" dir="ltr">#{item.batchNumber}</span>}
                          </td>
                          <td className="text-gray-500 text-xs">{branchName(item.branchId)}</td>
                          <td className="text-gray-900" dir="ltr">{item.quantityOnHand.toLocaleString(fa ? "fa-IR" : "en-US")} {item.unit}</td>
                          <td className="text-gray-500" dir="ltr">{item.reorderLevel.toLocaleString(fa ? "fa-IR" : "en-US")}</td>
                          <td>
                            {item.lowStock ? (
                              <span className="badge badge-red flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {t.inventory.lowStock}
                              </span>
                            ) : (
                              <span className="badge badge-green w-fit">{fa ? "کافی" : "OK"}</span>
                            )}
                          </td>
                          <td>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50/70 !py-4">
                              <div className="grid md:grid-cols-2 gap-5" onClick={e => e.stopPropagation()}>

                                {/* ─── فرم تعدیل موجودی ─────────────── */}
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 mb-2">{t.inventory.adjust}</div>
                                  <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <select value={af.type} onChange={e => setAdjustForm(prev => ({ ...prev, [item.id]: { ...af, type: e.target.value } }))}
                                        className="input-field text-xs !py-1.5">
                                        {TX_TYPES.map(tp => <option key={tp} value={tp}>{txTypeLabel(tp)}</option>)}
                                      </select>
                                      <input type="number" placeholder={t.inventory.adjustment.quantityDelta} value={af.quantityDelta}
                                        onChange={e => setAdjustForm(prev => ({ ...prev, [item.id]: { ...af, quantityDelta: e.target.value } }))}
                                        className="input-field text-xs !py-1.5" dir="ltr" />
                                    </div>
                                    <input placeholder={t.inventory.adjustment.reference} value={af.reference}
                                      onChange={e => setAdjustForm(prev => ({ ...prev, [item.id]: { ...af, reference: e.target.value } }))}
                                      className="input-field text-xs !py-1.5 w-full" />
                                    <input placeholder={t.inventory.adjustment.notes} value={af.notes}
                                      onChange={e => setAdjustForm(prev => ({ ...prev, [item.id]: { ...af, notes: e.target.value } }))}
                                      className="input-field text-xs !py-1.5 w-full" />
                                    <button onClick={() => submitAdjust(item)} disabled={adjusting[item.id]}
                                      className="btn-primary text-xs !py-1.5 w-full disabled:opacity-60">
                                      {t.inventory.adjust}
                                    </button>
                                  </div>
                                </div>

                                {/* ─── تاریخچه تراکنش‌ها ────────────── */}
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 mb-2">{t.inventory.transactions}</div>
                                  {loadingTx[item.id] ? (
                                    <div className="text-xs text-gray-400">{t.common.loading}</div>
                                  ) : txs.length === 0 ? (
                                    <div className="text-xs text-gray-400">{fa ? "تراکنشی ثبت نشده" : "No transactions yet"}</div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                      {txs.map(tx => (
                                        <div key={tx.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                          <span className="text-gray-700">{txTypeLabel(tx.type)}</span>
                                          <span className={tx.quantityDelta >= 0 ? "text-green-600" : "text-red-500"} dir="ltr">
                                            {tx.quantityDelta > 0 ? "+" : ""}{tx.quantityDelta.toLocaleString(fa ? "fa-IR" : "en-US")}
                                          </span>
                                          <span className="text-gray-400" dir="ltr">{t.inventory.balanceAfter}: {tx.balanceAfter.toLocaleString(fa ? "fa-IR" : "en-US")}</span>
                                          <span className="text-gray-400 whitespace-nowrap" dir="ltr">
                                            {new Date(tx.createdAt).toLocaleDateString(fa ? "fa-IR" : "en-US")}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
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
        <NewInventoryItemModal
          lang={lang}
          t={t}
          branches={branches}
          onClose={() => setShowNewModal(false)}
          onSaved={loadItems}
        />
      )}
    </AdminLayout>
  );
}
