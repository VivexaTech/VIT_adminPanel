"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { subscribeToMaterials, upsertMaterial, deleteMaterial, MATERIAL_TYPES } from "@/lib/materialService";
import { filterBatchesForTrainer, subscribeToBatches } from "@/lib/batchService";
import { subscribeToCourses } from "@/lib/courseService";
import { createStudentNotification } from "@/lib/notificationService";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import type { StudyMaterial } from "@/types/erp";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function MaterialsPage() {
  const { user } = useAuth();
  const { isTrainer } = usePermissions();
  const { showToast } = useToast();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; courseId?: string; studentIds?: string[] }[]>([]);
  const [form, setForm] = useState<Partial<StudyMaterial> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribeToMaterials(setMaterials),
      subscribeToCourses((c) => setCourses(c.map((x) => ({ id: x.id, title: x.title })))),
      subscribeToBatches((b) =>
        setBatches(b.map((x) => ({ id: x.id, name: x.name, courseId: x.courseId, studentIds: x.studentIds })))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const visibleBatches = useMemo(
    () =>
      isTrainer
        ? filterBatchesForTrainer(
            batches.map((b) => ({
              id: b.id,
              batchId: b.id,
              name: b.name,
              courseId: b.courseId || "",
              courseTitle: "",
              trainerName: "",
              startDate: "",
              endDate: "",
              schedule: { days: [], startTime: "", endTime: "" },
              meetLink: "",
              status: "active" as const,
              studentIds: b.studentIds || [],
            })),
            user?.assignedBatchIds
          ).map((b) => ({ id: b.id, name: b.name, courseId: b.courseId, studentIds: b.studentIds }))
        : batches,
    [batches, isTrainer, user?.assignedBatchIds]
  );

  const notifyTargetStudents = async (material: {
    title: string;
    courseId: string;
    batchId?: string;
  }) => {
    try {
      let studentIds: string[] = [];
      if (material.batchId) {
        const batch = batches.find((b) => b.id === material.batchId);
        studentIds = batch?.studentIds || [];
      } else {
        const studentsSnap = await getDocs(collection(db, "students"));
        studentsSnap.forEach((d) => {
          const enrolled = d.data().enrolledCourses;
          const match =
            Array.isArray(enrolled) &&
            enrolled.some((e: { courseId?: string }) => e.courseId === material.courseId);
          if (match || d.data().enrolledCourse?.courseId === material.courseId) {
            studentIds.push(d.id);
          }
        });
      }
      await Promise.allSettled(
        studentIds.map((sid) =>
          createStudentNotification({
            studentId: sid,
            type: "study_material",
            title: "New Study Material",
            message: `${material.title} has been shared with your course.`,
            route: `/course/materials?courseId=${material.courseId}`,
          })
        )
      );
    } catch (err) {
      console.error("Material notification failed:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.title || !form.courseId || !form.fileUrl) {
      showToast("error", "Title, course, and file URL required.");
      return;
    }
    setSaving(true);
    try {
      const courseTitle = courses.find((c) => c.id === form.courseId)?.title || form.courseTitle || "";
      const isEdit = !!form.id;
      await upsertMaterial({
        id: form.id,
        title: form.title,
        courseId: form.courseId,
        courseTitle,
        batchId: form.batchId || "",
        type: form.type || "pdf",
        fileUrl: form.fileUrl,
      });
      if (!isEdit) {
        await notifyTargetStudents({
          title: form.title,
          courseId: form.courseId,
          batchId: form.batchId,
        });
      }
      showToast("success", isEdit ? "Study material updated." : "Study material added.");
      setForm(null);
    } catch {
      showToast("error", "Failed to save study material.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMaterial(deleteId);
      showToast("success", "Study material deleted.");
    } catch {
      showToast("error", "Failed to delete.");
    } finally {
      setDeleteId(null);
    }
  };

  const batchFilteredFormBatches = useMemo(() => {
    if (!form?.courseId) return visibleBatches;
    return visibleBatches.filter((b) => !b.courseId || b.courseId === form.courseId);
  }, [visibleBatches, form?.courseId]);

  return (
    <PageTransition>
      <div className="flex justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-[#6C3CE9]" size={26} /> Study Materials
          </h1>
          <p className="text-slate-500 text-sm mt-1">Upload and edit PDFs, docs, and resources by course/batch.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setForm({ type: "pdf" })}>
          <Plus size={18} /> Add Material
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.length === 0 ? (
          <div className="col-span-full text-center text-slate-400 py-12">No study materials yet.</div>
        ) : (
          materials.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4 flex flex-col gap-2">
              <p className="font-semibold text-slate-900">{m.title}</p>
              <p className="text-xs text-slate-500 uppercase">{m.type}</p>
              <p className="text-xs text-slate-500">{m.courseTitle || m.courseId}</p>
              {m.batchId ? (
                <p className="text-xs text-slate-400">
                  Batch: {batches.find((b) => b.id === m.batchId)?.name || m.batchId}
                </p>
              ) : (
                <p className="text-xs text-slate-400">All batches</p>
              )}
              <div className="flex items-center gap-2 mt-auto pt-2">
                <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-[#6C3CE9] text-sm flex-1">
                  Open
                </a>
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-[#6C3CE9]"
                  onClick={() => setForm(m)}
                  aria-label="Edit"
                >
                  <Pencil size={16} />
                </button>
                {!isTrainer && (
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-red-500"
                    onClick={() => setDeleteId(m.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <h3 className="font-semibold">{form.id ? "Edit Study Material" : "Add Study Material"}</h3>
            <div>
              <label className={labelClass}>Title</label>
              <input
                className={inputClass}
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                className={inputClass}
                value={form.type || "pdf"}
                onChange={(e) => setForm({ ...form, type: e.target.value as StudyMaterial["type"] })}
              >
                {MATERIAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Course</label>
              <select
                className={inputClass}
                value={form.courseId || ""}
                onChange={(e) => setForm({ ...form, courseId: e.target.value, batchId: "" })}
                required
              >
                <option value="">Select</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Batch (optional)</label>
              <select
                className={inputClass}
                value={form.batchId || ""}
                onChange={(e) => setForm({ ...form, batchId: e.target.value })}
              >
                <option value="">All batches</option>
                {batchFilteredFormBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>File URL (Drive / Cloudinary)</label>
              <input
                className={inputClass}
                value={form.fileUrl || ""}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                required
              />
            </div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" onClick={() => setForm(null)} className={btnSecondaryBlock}>
                Cancel
              </button>
              <button type="submit" className={btnPrimaryBlock} disabled={saving}>
                {saving ? "Saving..." : form.id ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete study material?"
        message="This will remove the material from student apps. Existing downloaded files are not affected."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </PageTransition>
  );
}
