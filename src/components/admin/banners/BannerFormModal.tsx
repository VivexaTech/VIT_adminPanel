"use client";

import { useEffect, useState } from "react";
import AdminModal from "@/components/ui/AdminModal";
import ImageUploadField from "@/components/admin/courses/ImageUploadField";
import { btnPrimary, btnSecondary, formGrid, inputClass, labelClass } from "@/lib/theme";
import type { Banner, BannerInput } from "@/types/marketing";

export default function BannerFormModal({ open, banner, nextOrder, saving, onClose, onSubmit }: {
  open: boolean; banner: Banner | null; nextOrder: number; saving: boolean; onClose: () => void; onSubmit: (values: BannerInput) => Promise<void>;
}) {
  const [values, setValues] = useState<BannerInput>({ imageUrl: "", order: nextOrder, active: true });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setValues(banner ? {
      imageUrl: banner.imageUrl, title: banner.title, subtitle: banner.subtitle, buttonText: banner.buttonText,
      buttonLink: banner.buttonLink, order: banner.order, active: banner.active,
    } : { imageUrl: "", order: nextOrder, active: true });
  }, [open, banner, nextOrder]);
  const submit = async () => {
    if (!values.imageUrl.trim()) return setError("Banner image is required.");
    if (values.buttonLink && !values.buttonText?.trim()) return setError("Add button text when using a button link.");
    setError("");
    try { await onSubmit(values); } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to save banner."); }
  };
  return <AdminModal open={open} onClose={onClose} title={banner ? "Edit Website Banner" : "Add Website Banner"} size="lg"
    footer={<><button className={btnSecondary} onClick={onClose} disabled={saving}>Cancel</button><button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Banner"}</button></>}>
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <ImageUploadField label="Banner image" value={values.imageUrl} onChange={(imageUrl) => setValues({ ...values, imageUrl })} required hint="Recommended 16:9 image, up to 5 MB." />
      <div className={formGrid}>
        <Field label="Title"><input className={inputClass} value={values.title ?? ""} onChange={(e) => setValues({ ...values, title: e.target.value || undefined })} /></Field>
        <Field label="Subtitle"><input className={inputClass} value={values.subtitle ?? ""} onChange={(e) => setValues({ ...values, subtitle: e.target.value || undefined })} /></Field>
        <Field label="Button text"><input className={inputClass} value={values.buttonText ?? ""} onChange={(e) => setValues({ ...values, buttonText: e.target.value || undefined })} /></Field>
        <Field label="Button link"><input className={inputClass} value={values.buttonLink ?? ""} onChange={(e) => setValues({ ...values, buttonLink: e.target.value || undefined })} /></Field>
        <Field label="Display order"><input type="number" min="1" className={inputClass} value={values.order} onChange={(e) => setValues({ ...values, order: Number(e.target.value) })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.active} onChange={(e) => setValues({ ...values, active: e.target.checked })} /> Active</label>
    </div>
  </AdminModal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>;
}
