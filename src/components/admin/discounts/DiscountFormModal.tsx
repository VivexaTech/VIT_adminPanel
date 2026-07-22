"use client";

import { useEffect, useState } from "react";
import AdminModal from "@/components/ui/AdminModal";
import { btnPrimary, btnSecondary, formGrid, inputClass, labelClass } from "@/lib/theme";
import type { Discount, DiscountInput } from "@/types/marketing";

const empty: DiscountInput = { name: "", code: "", type: "percentage", value: 0, active: true, description: "" };
const optionalNumber = (value: string) => value === "" ? undefined : Number(value);

export default function DiscountFormModal({ open, discount, saving, onClose, onSubmit }: {
  open: boolean; discount: Discount | null; saving: boolean; onClose: () => void; onSubmit: (values: DiscountInput) => Promise<void>;
}) {
  const [values, setValues] = useState<DiscountInput>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setValues(discount ? {
      name: discount.name, code: discount.code, type: discount.type, value: discount.value,
      maxDiscount: discount.maxDiscount, minFee: discount.minFee, expiryDate: discount.expiryDate,
      usageLimit: discount.usageLimit, active: discount.active, description: discount.description ?? "",
    } : empty);
  }, [open, discount]);

  const submit = async () => {
    if (!values.name.trim()) return setError("Name is required.");
    if (!/^[A-Z0-9]+$/.test(values.code)) return setError("Code must contain uppercase letters and numbers only.");
    if (values.type === "percentage" && (values.value < 1 || values.value > 100)) return setError("Percentage must be between 1 and 100.");
    if (values.type === "flat" && values.value <= 0) return setError("Flat discount must be greater than zero.");
    if (values.usageLimit !== undefined && (!Number.isInteger(values.usageLimit) || values.usageLimit < 1)) return setError("Usage limit must be a positive whole number.");
    setError("");
    try { await onSubmit(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to save discount."); }
  };

  return <AdminModal open={open} onClose={onClose} title={discount ? "Edit Discount" : "Add Discount"} size="lg"
    footer={<><button className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button><button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Discount"}</button></>}>
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className={formGrid}>
        <Field label="Name"><input className={inputClass} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></Field>
        <Field label="Code"><input className={inputClass} value={values.code} onChange={(e) => setValues({ ...values, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></Field>
        <Field label="Type"><select className={inputClass} value={values.type} onChange={(e) => setValues({ ...values, type: e.target.value as DiscountInput["type"] })}><option value="percentage">Percentage</option><option value="flat">Flat amount</option></select></Field>
        <Field label="Value"><input type="number" className={inputClass} value={values.value} onChange={(e) => setValues({ ...values, value: Number(e.target.value) })} /></Field>
        <Field label="Maximum discount"><input type="number" min="0" className={inputClass} value={values.maxDiscount ?? ""} onChange={(e) => setValues({ ...values, maxDiscount: optionalNumber(e.target.value) })} /></Field>
        <Field label="Minimum fee"><input type="number" min="0" className={inputClass} value={values.minFee ?? ""} onChange={(e) => setValues({ ...values, minFee: optionalNumber(e.target.value) })} /></Field>
        <Field label="Expiry date"><input type="date" className={inputClass} value={values.expiryDate ?? ""} onChange={(e) => setValues({ ...values, expiryDate: e.target.value || undefined })} /></Field>
        <Field label="Usage limit"><input type="number" min="1" step="1" className={inputClass} value={values.usageLimit ?? ""} onChange={(e) => setValues({ ...values, usageLimit: optionalNumber(e.target.value) })} /></Field>
      </div>
      <Field label="Description"><textarea className={`${inputClass} min-h-24`} value={values.description ?? ""} onChange={(e) => setValues({ ...values, description: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.active} onChange={(e) => setValues({ ...values, active: e.target.checked })} /> Active</label>
    </div>
  </AdminModal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>;
}
