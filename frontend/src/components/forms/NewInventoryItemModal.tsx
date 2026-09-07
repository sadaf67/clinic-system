"use client";

// ══════════════════════════════════════════════════════════════
// فرم افزودن قلم جدید به انبار (پنجره پاپ‌آپ)
// از صفحه لیست انبار (admin/inventory) استفاده میشه.
// ══════════════════════════════════════════════════════════════
import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { inventoryApi } from "@/lib/api/axios";

export default function NewInventoryItemModal({
  lang, t, branches, onClose, onSaved,
}: {
  lang: string;
  t: any;
  branches: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const fa = lang === "fa";
  const [branchId, setBranchId] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState(0);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!sku.trim() || !name.trim() || !unit.trim()) {
      toast.error(fa ? "کد کالا، نام و واحد الزامی است" : "SKU, name and unit are required");
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.create({
        branchId: branchId || null,
        sku: sku.trim(), name: name.trim(), unit: unit.trim(),
        reorderLevel: Number(reorderLevel) || 0,
        batchNumber: batchNumber.trim() || null,
        expiryDate: expiryDate || null,
      });
      toast.success(fa ? "قلم انبار ثبت شد" : "Inventory item created");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (fa ? "ثبت قلم ناموفق بود" : "Could not create item"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir={fa ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">{t.inventory.new}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.branch}</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="input-field">
              <option value="">{t.inventory.allBranches}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.sku}</label>
              <input value={sku} onChange={e => setSku(e.target.value)} className="input-field" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.unit}</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} className="input-field" placeholder={fa ? "مثال: عدد، بسته" : "e.g. piece, box"} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.name}</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.reorderLevel}</label>
              <input type="number" min={0} value={reorderLevel} onChange={e => setReorderLevel(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.batchNumber}</label>
              <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="input-field" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.inventory.expiryDate}</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="input-field" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button onClick={save} disabled={saving}
              className="btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? (fa ? "در حال ذخیره..." : "Saving...") : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
