"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  deleteHoliday,
  subscribeToHolidays,
  upsertHoliday,
  type InstituteHoliday,
} from "@/lib/holidayService";
import { createStudentNotification } from "@/lib/notificationService";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function HolidaysPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<InstituteHoliday[]>([]);
  const [form, setForm] = useState<Partial<InstituteHoliday> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeToHolidays(setHolidays), []);

  const notifyStudents = async (holiday: { date: string; title: string; reason?: string }) => {
    try {
      const studentsSnap = await getDocs(collection(db, "students"));
      const tasks: Promise<unknown>[] = [];
      studentsSnap.forEach((d) => {
        tasks.push(
          createStudentNotification({
            studentId: d.id,
            type: "system",
            title: `Institute Holiday — ${holiday.title}`,
            message: `${holiday.date}: ${holiday.title}${holiday.reason ? ` (${holiday.reason})` : ""}. Institute is closed.`,
            route: "/calendar",
          })
        );
      });
      await Promise.allSettled(tasks);
    } catch (err) {
      console.error("Holiday notification failed:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.date || !form.title?.trim()) {
      showToast("error", "Date and title are required.");
      return;
    }
    setSaving(true);
    try {
      const id = await upsertHoliday(
        {
          id: form.id,
          date: form.date,
          title: form.title.trim(),
          reason: form.reason || "",
        },
        user?.email || ""
      );
      const isNew = !form.id;
      if (isNew) {
        await notifyStudents({
          date: form.date,
          title: form.title.trim(),
          reason: form.reason,
        });
      }
      showToast("success", isNew ? "Holiday declared and students notified." : "Holiday updated.");
      setForm(null);
      void id;
    } catch {
      showToast("error", "Failed to save holiday.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteHoliday(deleteId);
      showToast("success", "Holiday removed.");
    } catch {
      showToast("error", "Failed to delete holiday.");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <PageTransition>
      <div className="flex justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarOff className="text-[#6C3CE9]" size={26} /> Institute Holidays / Off Days
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Declare official holidays. Students are notified and attendance is blocked for these dates.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setForm({ date: "", title: "Institute Holiday", reason: "" })}
        >
          <Plus size={18} /> Add Holiday
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Reason</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                  No holidays declared yet.
                </td>
              </tr>
            ) : (
              holidays.map((h) => (
                <tr key={h.id} className="border-b border-slate-50">
                  <td className="px-5 py-4 font-medium text-slate-800">{h.date}</td>
                  <td className="px-5 py-4">{h.title}</td>
                  <td className="px-5 py-4 text-slate-500 text-sm">{h.reason || "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-sm text-[#6C3CE9]"
                        onClick={() => setForm(h)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-red-500"
                        onClick={() => setDeleteId(h.id)}
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <h3 className="font-semibold text-lg">{form.id ? "Edit Holiday" : "Declare Holiday"}</h3>
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.date || ""}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                disabled={!!form.id}
              />
            </div>
            <div>
              <label className={labelClass}>Title</label>
              <input
                className={inputClass}
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Institute Holiday"
              />
            </div>
            <div>
              <label className={labelClass}>Reason (optional)</label>
              <textarea
                className={inputClass}
                rows={3}
                value={form.reason || ""}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Independence Day"
              />
            </div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" onClick={() => setForm(null)} className={btnSecondaryBlock}>
                Cancel
              </button>
              <button type="submit" className={btnPrimaryBlock} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Remove holiday?"
        message="Students will no longer see this date as an institute holiday."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </PageTransition>
  );
}
