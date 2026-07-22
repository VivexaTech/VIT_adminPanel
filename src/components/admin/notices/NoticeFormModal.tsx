"use client";

import { useEffect, useState } from "react";
import AdminModal from "@/components/ui/AdminModal";
import { btnPrimary, btnSecondary, formGrid, inputClass, labelClass } from "@/lib/theme";
import type { Notice, NoticeInput } from "@/types/marketing";

const colors = ["#6C3CE9", "#3B82F6", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4"];
const empty: NoticeInput = { title: "", description: "", type: "notice", color: colors[0], priority: 0, active: true, showInMarquee: false, showAsPopup: false, showOnHomepage: false };

export default function NoticeFormModal({ open, notice, saving, onClose, onSubmit }: {
  open: boolean; notice: Notice | null; saving: boolean; onClose: () => void; onSubmit: (values: NoticeInput) => Promise<void>;
}) {
  const [values, setValues] = useState<NoticeInput>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setValues(notice ? {
      title: notice.title, description: notice.description, type: notice.type, color: notice.color,
      priority: notice.priority, startDate: notice.startDate, endDate: notice.endDate, active: notice.active,
      showInMarquee: notice.showInMarquee, showAsPopup: notice.showAsPopup,
      showOnHomepage: notice.showOnHomepage, link: notice.link,
    } : empty);
  }, [open, notice]);
  const submit = async () => {
    if (!values.title.trim() || !values.description.trim()) return setError("Title and description are required.");
    if (values.startDate && values.endDate && values.endDate < values.startDate) return setError("End date cannot be before start date.");
    setError("");
    try { await onSubmit(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to save notice."); }
  };
  return <AdminModal open={open} onClose={onClose} title={notice ? "Edit Offer / Notice" : "Add Offer / Notice"} size="lg"
    footer={<><button className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button><button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</button></>}>
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className={formGrid}>
        <Field label="Title"><input className={inputClass} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} /></Field>
        <Field label="Type"><select className={inputClass} value={values.type} onChange={(e) => setValues({ ...values, type: e.target.value as NoticeInput["type"] })}>{["offer", "notice", "popup", "admission"].map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Priority"><input type="number" className={inputClass} value={values.priority} onChange={(e) => setValues({ ...values, priority: Number(e.target.value) })} /></Field>
        <Field label="Link"><input type="url" className={inputClass} value={values.link ?? ""} onChange={(e) => setValues({ ...values, link: e.target.value || undefined })} placeholder="https://..." /></Field>
        <Field label="Start date"><input type="date" className={inputClass} value={values.startDate ?? ""} onChange={(e) => setValues({ ...values, startDate: e.target.value || undefined })} /></Field>
        <Field label="End date"><input type="date" className={inputClass} value={values.endDate ?? ""} onChange={(e) => setValues({ ...values, endDate: e.target.value || undefined })} /></Field>
      </div>
      <Field label="Description"><textarea className={`${inputClass} min-h-28`} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} /></Field>
      <div><span className={labelClass}>Color</span><div className="flex flex-wrap gap-2">{colors.map((color) => <button type="button" key={color} aria-label={`Use ${color}`} onClick={() => setValues({ ...values, color })} className={`h-9 w-9 rounded-full border-4 ${values.color === color ? "border-slate-900" : "border-white"}`} style={{ backgroundColor: color }} />)}<input type="color" value={values.color} onChange={(e) => setValues({ ...values, color: e.target.value })} className="h-9 w-12" /></div></div>
      <div className="grid gap-3 sm:grid-cols-2">{([["active", "Active"], ["showInMarquee", "Show in marquee"], ["showAsPopup", "Show as popup"], ["showOnHomepage", "Show on homepage"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.checked })} />{label}</label>)}</div>
    </div>
  </AdminModal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>;
}
