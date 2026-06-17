"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { subscribeToBatches } from "@/lib/batchService";
import { saveAttendance } from "@/lib/attendanceService";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, inputClass, labelClass } from "@/lib/theme";
import { CalendarCheck } from "lucide-react";
import type { AttendanceEntry, AttendanceStatus, Batch } from "@/types/erp";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AttendancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeToBatches(setBatches), []);

  const selectedBatch = useMemo(() => batches.find((b) => b.id === batchId), [batches, batchId]);

  useEffect(() => {
    if (!selectedBatch) { setEntries([]); return; }
    (async () => {
      const list: AttendanceEntry[] = [];
      for (const sid of selectedBatch.studentIds ?? []) {
        const snap = await getDoc(doc(db, "students", sid));
        list.push({
          studentId: sid,
          studentName: snap.exists() ? snap.data().fullName || sid : sid,
          status: "present",
        });
      }
      setEntries(list);
    })();
  }, [selectedBatch]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, status } : e)));
  };

  const handleSave = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    try {
      await saveAttendance(
        selectedBatch.batchId,
        selectedBatch.courseId,
        date,
        entries,
        user?.email || "admin"
      );
      showToast("success", "Attendance saved and synced to student apps.");
    } catch {
      showToast("error", "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarCheck className="text-[#6C3CE9]" size={26} /> Trainer Attendance
        </h1>
        <p className="text-slate-500 text-sm mt-1">Mark present, absent, or late for batch students.</p>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Batch</label>
          <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="button" className={btnPrimary + " w-full"} disabled={!entries.length || saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {!batchId ? (
              <tr><td colSpan={2} className="px-5 py-12 text-center text-slate-400">Select a batch to mark attendance.</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={2} className="px-5 py-12 text-center text-slate-400">No students in this batch.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.studentId} className="border-b border-slate-50">
                  <td className="px-5 py-4 font-medium">{e.studentName}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {(["present", "absent", "late"] as AttendanceStatus[]).map((s) => (
                        <button key={s} type="button" onClick={() => setStatus(e.studentId, s)}
                          className={`px-3 py-1 rounded-lg text-xs capitalize border ${
                            e.status === s
                              ? s === "present" ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                              : s === "absent" ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-amber-100 border-amber-300 text-amber-700"
                              : "border-slate-200 text-slate-500"
                          }`}>{s}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageTransition>
  );
}
