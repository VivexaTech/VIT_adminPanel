"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { subscribeToAssignments, createAssignment } from "@/lib/assignmentService";
import { subscribeToBatches } from "@/lib/batchService";
import { subscribeToCourses } from "@/lib/courseService";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { PenLine, Plus } from "lucide-react";
import type { Assignment } from "@/types/erp";
import type { Batch } from "@/types/erp";

export default function AssignmentsPage() {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [form, setForm] = useState<Partial<Assignment> | null>(null);

  useEffect(() => {
    subscribeToAssignments(setAssignments);
    subscribeToBatches(setBatches);
    subscribeToCourses((c) => setCourses(c.map((x) => ({ id: x.id, title: x.title }))));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === form?.batchId);
    if (!form?.title || !form.courseId || !form.deadline) {
      showToast("error", "Title, course, and deadline required.");
      return;
    }
    await createAssignment({
      title: form.title,
      courseId: form.courseId,
      batchId: form.batchId,
      description: form.description,
      deadline: form.deadline,
      maxMarks: form.maxMarks || 100,
      assignedStudentIds: batch?.studentIds ?? [],
    });
    showToast("success", "Assignment created and assigned.");
    setForm(null);
  };

  return (
    <PageTransition>
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><PenLine className="text-[#6C3CE9]" size={26} /> Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">Create assignments and assign to batch students.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setForm({ maxMarks: 100 })}><Plus size={18} /> Create</button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead><tr className="border-b bg-slate-50/80">
            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Deadline</th>
            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Students</th>
          </tr></thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-slate-50">
                <td className="px-5 py-4 font-medium">{a.title}</td>
                <td className="px-5 py-4 text-sm">{a.deadline}</td>
                <td className="px-5 py-4 text-sm">{a.assignedStudentIds?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold">New Assignment</h3>
            <div><label className={labelClass}>Title</label><input className={inputClass} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className={labelClass}>Course</label>
              <select className={inputClass} value={form.courseId || ""} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
                <option value="">Select</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select></div>
            <div><label className={labelClass}>Batch</label>
              <select className={inputClass} value={form.batchId || ""} onChange={(e) => setForm({ ...form, batchId: e.target.value })} required>
                <option value="">Select</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div><label className={labelClass}>Deadline</label><input type="date" className={inputClass} value={form.deadline?.slice(0, 10) || ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required /></div>
            <div><label className={labelClass}>Max Marks</label><input type="number" className={inputClass} value={form.maxMarks || 100} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} /></div>
            <div><label className={labelClass}>Description</label><textarea className={inputClass} rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" onClick={() => setForm(null)} className={btnSecondaryBlock}>Cancel</button>
              <button type="submit" className={btnPrimaryBlock}>Assign</button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
