"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { subscribeToCourses } from "@/lib/courseService";
import { subscribeToBatches, upsertBatch, deleteBatch, filterBatchesForTrainer } from "@/lib/batchService";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { createApprovalRequest } from "@/lib/approvalService";
import { isSuperAdmin } from "@/lib/rbac";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { Layers, Plus, Trash2, Edit2 } from "lucide-react";
import type { Batch } from "@/types/erp";
import { WEEK_DAYS } from "@/types/erp";
import type { Course } from "@/types/course";
import { arrayUnion, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const emptyForm = (): Partial<Batch> => ({
  name: "",
  courseId: "",
  courseTitle: "",
  trainerName: "",
  startDate: "",
  endDate: "",
  meetLink: "",
  status: "active",
  studentIds: [],
  schedule: { days: ["Monday", "Wednesday", "Friday"], startTime: "10:00", endTime: "12:00" },
});

export default function BatchesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isTrainer } = usePermissions();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);
  const [trainers, setTrainers] = useState<{ email: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Batch> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribeToBatches((b) => { setBatches(b); setLoading(false); }),
      subscribeToCourses(setCourses),
      onSnapshot(collection(db, "students"), (snap) => {
        setStudents(snap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName || d.id })));
      }),
      onSnapshot(collection(db, "users"), (snap) => {
        setTrainers(
          snap.docs
            .filter((d) => {
              const r = d.data().role;
              return (r === "Trainer" || r === "Teaching Team") && d.data().status === "active";
            })
            .map((d) => ({ email: d.id, fullName: d.data().fullName || d.id }))
        );
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal?.name || !modal.courseId || !modal.trainerName) {
      showToast("error", "Batch name, course, and trainer are required.");
      return;
    }
    setSaving(true);
    try {
      const course = courses.find((c) => c.id === modal.courseId || c.courseId === modal.courseId);
      const savedId = await upsertBatch(
        {
          batchId: modal.batchId || modal.id || "",
          id: modal.id,
          name: modal.name.trim(),
          courseId: modal.courseId,
          courseTitle: course?.title || modal.courseTitle || "",
          trainerId: modal.trainerId || "",
          trainerName: modal.trainerName.trim(),
          startDate: modal.startDate || "",
          endDate: modal.endDate || "",
          schedule: modal.schedule!,
          meetLink: modal.meetLink?.trim() || "",
          status: modal.status || "active",
          studentIds: modal.studentIds || [],
        },
        { isNew: !modal.id }
      );
      if (modal.trainerId) {
        await updateDoc(doc(db, "users", modal.trainerId), {
          assignedBatchIds: arrayUnion(savedId),
        });
      }
      showToast("success", "Batch saved. Students and trainer assignments updated.");
      setModal(null);
    } catch {
      showToast("error", "Failed to save batch.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    if (!modal?.schedule) return;
    const days = modal.schedule.days.includes(day)
      ? modal.schedule.days.filter((d) => d !== day)
      : [...modal.schedule.days, day];
    setModal({ ...modal, schedule: { ...modal.schedule, days } });
  };

  const visibleBatches = useMemo(
    () => (isTrainer ? filterBatchesForTrainer(batches, user?.assignedBatchIds) : batches),
    [batches, isTrainer, user?.assignedBatchIds]
  );

  const activeCount = useMemo(() => visibleBatches.filter((b) => b.status === "active").length, [visibleBatches]);

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="text-[#6C3CE9]" size={26} /> Batch Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Define batch timing, trainer, and meeting links. Class schedules are derived from batches.
          </p>
        </div>
        {!isTrainer && (
          <button type="button" className={btnPrimary} onClick={() => setModal(emptyForm())}>
            <Plus size={18} /> Create Batch
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-4"><p className="text-xs text-slate-500">Total Batches</p><p className="text-2xl font-bold text-slate-900">{visibleBatches.length}</p></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-xs text-slate-500">Active</p><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></div>
      </div>

      <div className="lg:hidden space-y-3 mb-4">
        {visibleBatches.map((b) => (
          <div key={b.id} className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold text-slate-900">{b.name}</p>
                <p className="text-sm text-slate-500">{b.courseTitle}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{b.status}</span>
            </div>
            <p className="text-sm text-slate-600">Trainer: {b.trainerName}</p>
            <p className="text-xs text-slate-400">{b.schedule?.days?.join(", ")} · {b.schedule?.startTime}–{b.schedule?.endTime}</p>
            <p className="text-xs text-slate-500">{b.studentIds?.length ?? 0} students</p>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2 rounded-xl border border-slate-200 text-sm" onClick={() => setModal(b)}>Edit</button>
              {!isTrainer && (
                <button className="py-2 px-3 rounded-xl border border-red-100 text-red-500" onClick={() => setDeleteId(b.id)}><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden hidden lg:block">
        <div className="admin-table-scroll">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Trainer</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Schedule</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Students</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
            ) : visibleBatches.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No batches yet.</td></tr>
            ) : (
              visibleBatches.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-medium text-slate-900">{b.name}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{b.courseTitle}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{b.trainerName}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {b.schedule?.days?.join(", ")}<br />
                    <span className="text-xs text-slate-400">{b.schedule?.startTime} – {b.schedule?.endTime}</span>
                  </td>
                  <td className="px-5 py-4 text-sm">{b.studentIds?.length ?? 0}</td>
                  <td className="px-5 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-[#6C3CE9]" onClick={() => setModal(b)}><Edit2 size={16} /></button>
                    {!isTrainer && (
                      <button className="p-2 text-slate-400 hover:text-red-500" onClick={() => setDeleteId(b.id)}><Trash2 size={16} /></button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4 my-4 sm:my-8">
            <h3 className="font-semibold text-slate-900 text-lg">{modal.id ? "Edit Batch" : "New Batch"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Batch Name *</label><input className={inputClass} value={modal.name || ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} required /></div>
              <div>
                <label className={labelClass}>Course *</label>
                <select className={inputClass} value={modal.courseId || ""} onChange={(e) => {
                  const c = courses.find((x) => x.id === e.target.value);
                  setModal({ ...modal, courseId: e.target.value, courseTitle: c?.title });
                }} required>
                  <option value="">Select course</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Trainer *</label>
                <select
                  className={inputClass}
                  value={modal.trainerId || ""}
                  onChange={(e) => {
                    const t = trainers.find((x) => x.email === e.target.value);
                    setModal({ ...modal, trainerId: e.target.value, trainerName: t?.fullName || "" });
                  }}
                  required
                >
                  <option value="">Select trainer</option>
                  {trainers.map((t) => (
                    <option key={t.email} value={t.email}>{t.fullName}</option>
                  ))}
                </select>
                {!trainers.length && (
                  <input className={inputClass + " mt-2"} value={modal.trainerName || ""} onChange={(e) => setModal({ ...modal, trainerName: e.target.value })} placeholder="Or enter trainer name" required />
                )}
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={modal.status || "active"} onChange={(e) => setModal({ ...modal, status: e.target.value as Batch["status"] })}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div><label className={labelClass}>Meeting Link</label><input className={inputClass} value={modal.meetLink || ""} onChange={(e) => setModal({ ...modal, meetLink: e.target.value })} placeholder="Google Meet / Zoom URL" /></div>
              <div><label className={labelClass}>Start Date</label><input type="date" className={inputClass} value={modal.startDate?.slice(0, 10) || ""} onChange={(e) => setModal({ ...modal, startDate: e.target.value })} /></div>
              <div><label className={labelClass}>End Date</label><input type="date" className={inputClass} value={modal.endDate?.slice(0, 10) || ""} onChange={(e) => setModal({ ...modal, endDate: e.target.value })} /></div>
              <div><label className={labelClass}>Start Time</label><input type="time" className={inputClass} value={modal.schedule?.startTime || ""} onChange={(e) => setModal({ ...modal, schedule: { ...modal.schedule!, startTime: e.target.value } })} /></div>
              <div><label className={labelClass}>End Time</label><input type="time" className={inputClass} value={modal.schedule?.endTime || ""} onChange={(e) => setModal({ ...modal, schedule: { ...modal.schedule!, endTime: e.target.value } })} /></div>
            </div>
            <div>
              <label className={labelClass}>Class Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${modal.schedule?.days.includes(day) ? "bg-[#EDE7FF] border-[#6C3CE9] text-[#6C3CE9]" : "border-slate-200 text-slate-600"}`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Assign Students</label>
              <select multiple className={inputClass + " h-32"} value={modal.studentIds || []}
                onChange={(e) => setModal({ ...modal, studentIds: Array.from(e.target.selectedOptions, (o) => o.value) })}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" className={btnSecondaryBlock} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className={btnPrimaryBlock} disabled={saving}>{saving ? "Saving..." : "Save Batch"}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} title="Delete Batch" message="Remove this batch?" destructive confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteId || !user) return;
          const batch = batches.find((b) => b.id === deleteId);
          if (!isSuperAdmin(user.role)) {
            await createApprovalRequest(user, {
              actionType: "batch_delete",
              targetId: deleteId,
              targetLabel: batch?.name,
              remarks: `Delete batch ${batch?.name}`,
              payload: { batchId: deleteId },
            });
            showToast("success", "Batch deletion submitted. Status: Pending Approval.");
          } else {
            await deleteBatch(deleteId);
            showToast("success", "Deleted.");
          }
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)} />
    </PageTransition>
  );
}
