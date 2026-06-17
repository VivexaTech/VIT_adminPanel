"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { subscribeToMaterials, upsertMaterial, deleteMaterial, MATERIAL_TYPES } from "@/lib/materialService";
import { subscribeToBatches } from "@/lib/batchService";
import { subscribeToCourses } from "@/lib/courseService";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { FileText, Plus } from "lucide-react";
import type { StudyMaterial } from "@/types/erp";

export default function MaterialsPage() {
  const { showToast } = useToast();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Partial<StudyMaterial> | null>(null);

  useEffect(() => {
    subscribeToMaterials(setMaterials);
    subscribeToCourses((c) => setCourses(c.map((x) => ({ id: x.id, title: x.title }))));
    subscribeToBatches((b) => setBatches(b.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.title || !form.courseId || !form.fileUrl) {
      showToast("error", "Title, course, and file URL required.");
      return;
    }
    await upsertMaterial({
      title: form.title,
      courseId: form.courseId,
      batchId: form.batchId,
      type: form.type || "pdf",
      fileUrl: form.fileUrl,
    });
    showToast("success", "Study material added.");
    setForm(null);
  };

  return (
    <PageTransition>
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FileText className="text-[#6C3CE9]" size={26} /> Study Materials</h1>
          <p className="text-slate-500 text-sm mt-1">Upload PDFs, docs, and resources by course/batch.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setForm({ type: "pdf" })}><Plus size={18} /> Add Material</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((m) => (
          <div key={m.id} className="glass-card rounded-2xl p-4">
            <p className="font-semibold text-slate-900">{m.title}</p>
            <p className="text-xs text-slate-500 uppercase mt-1">{m.type}</p>
            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-[#6C3CE9] text-sm mt-2 inline-block">Download</a>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold">Add Study Material</h3>
            <div><label className={labelClass}>Title</label><input className={inputClass} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className={labelClass}>Type</label>
              <select className={inputClass} value={form.type || "pdf"} onChange={(e) => setForm({ ...form, type: e.target.value as StudyMaterial["type"] })}>
                {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className={labelClass}>Course</label>
              <select className={inputClass} value={form.courseId || ""} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
                <option value="">Select</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select></div>
            <div><label className={labelClass}>Batch (optional)</label>
              <select className={inputClass} value={form.batchId || ""} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                <option value="">All</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div><label className={labelClass}>File URL (Drive / Cloudinary)</label><input className={inputClass} value={form.fileUrl || ""} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} required /></div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" onClick={() => setForm(null)} className={btnSecondaryBlock}>Cancel</button>
              <button type="submit" className={btnPrimaryBlock}>Save</button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
