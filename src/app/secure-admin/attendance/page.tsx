"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { filterBatchesForTrainer, subscribeToBatches } from "@/lib/batchService";
import { getAttendanceForBatchDate, saveAttendance, subscribeToAttendance } from "@/lib/attendanceService";
import { subscribeToHolidays, type InstituteHoliday } from "@/lib/holidayService";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, inputClass, labelClass } from "@/lib/theme";
import { CalendarCheck } from "lucide-react";
import type { AttendanceEntry, AttendanceRecord, AttendanceStatus, Batch } from "@/types/erp";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AttendancePage() {
  const { user } = useAuth();
  const { isTrainer } = usePermissions();
  const { showToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<InstituteHoliday[]>([]);
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeToBatches(setBatches),
      subscribeToAttendance(setAllRecords),
      subscribeToHolidays(setHolidays),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const visibleBatches = useMemo(
    () => (isTrainer ? filterBatchesForTrainer(batches, user?.assignedBatchIds) : batches),
    [batches, isTrainer, user?.assignedBatchIds]
  );

  const selectedBatch = useMemo(
    () => visibleBatches.find((b) => b.id === batchId || b.batchId === batchId),
    [visibleBatches, batchId]
  );

  const holidayToday = useMemo(
    () => holidays.find((h) => h.date === date) || null,
    [holidays, date]
  );

  useEffect(() => {
    if (!selectedBatch) {
      setEntries([]);
      setIsUpdate(false);
      return;
    }
    const effectiveBatchId = selectedBatch.batchId || selectedBatch.id;
    (async () => {
      const existing = await getAttendanceForBatchDate(effectiveBatchId, date);
      const existingMap = new Map(
        (existing?.records || []).map((r) => [r.studentId, r.status])
      );
      setIsUpdate(!!existing);

      const list: AttendanceEntry[] = [];
      for (const sid of selectedBatch.studentIds ?? []) {
        const snap = await getDoc(doc(db, "students", sid));
        list.push({
          studentId: sid,
          studentName: snap.exists() ? snap.data().fullName || sid : sid,
          status: existingMap.get(sid) || "present",
        });
      }
      setEntries(list);
    })();
  }, [selectedBatch, date]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, status } : e)));
  };

  const filteredEntries = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.studentName.toLowerCase().includes(q) ||
        e.studentId.toLowerCase().includes(q)
    );
  }, [entries, studentFilter]);

  const historyForBatch = useMemo(() => {
    if (!selectedBatch) return [];
    const bid = selectedBatch.batchId || selectedBatch.id;
    return allRecords.filter((r) => r.batchId === bid).slice(0, 20);
  }, [allRecords, selectedBatch]);

  const handleSave = async () => {
    if (!selectedBatch) return;
    if (holidayToday) {
      showToast("error", `Cannot mark attendance — institute holiday: ${holidayToday.title}`);
      return;
    }
    setSaving(true);
    try {
      const effectiveBatchId = selectedBatch.batchId || selectedBatch.id;
      await saveAttendance(
        effectiveBatchId,
        selectedBatch.courseId,
        date,
        entries,
        user?.email || "admin",
        { batchName: selectedBatch.name, courseTitle: selectedBatch.courseTitle }
      );
      showToast(
        "success",
        isUpdate
          ? "Attendance updated (no duplicate record created)."
          : "Attendance saved and synced to student apps."
      );
      setIsUpdate(true);
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
          <CalendarCheck className="text-[#6C3CE9]" size={26} /> Attendance
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Mark or update attendance by batch and date. Re-saving updates the same record (Student + Date + Batch).
        </p>
      </div>

      {holidayToday && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Institute holiday on {holidayToday.date}: <strong>{holidayToday.title}</strong>
          {holidayToday.reason ? ` — ${holidayToday.reason}` : ""}. Attendance cannot be marked.
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Batch</label>
          <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {visibleBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Filter student</label>
          <input
            className={inputClass}
            placeholder="Name or ID"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className={btnPrimary + " w-full"}
            disabled={!entries.length || saving || !!holidayToday}
            onClick={handleSave}
          >
            {saving ? "Saving..." : isUpdate ? "Update Attendance" : "Save Attendance"}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden mb-6">
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
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={2} className="px-5 py-12 text-center text-slate-400">No students match.</td></tr>
            ) : (
              filteredEntries.map((e) => (
                <tr key={e.studentId} className="border-b border-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium">{e.studentName}</p>
                    <p className="text-xs text-slate-400">{e.studentId}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {(["present", "absent", "late"] as AttendanceStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(e.studentId, s)}
                          className={`px-3 py-1 rounded-lg text-xs capitalize border ${
                            e.status === s
                              ? s === "present"
                                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                : s === "absent"
                                  ? "bg-red-100 border-red-300 text-red-700"
                                  : "bg-amber-100 border-amber-300 text-amber-700"
                              : "border-slate-200 text-slate-500"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedBatch && (
        <div className="glass-card rounded-2xl p-4">
          <h2 className="font-semibold text-slate-900 mb-3">Recent attendance — {selectedBatch.name}</h2>
          {historyForBatch.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance records yet for this batch.</p>
          ) : (
            <div className="space-y-2">
              {historyForBatch.map((r) => {
                const present = (r.records || []).filter((x) => x.status === "present" || x.status === "late").length;
                const total = (r.records || []).length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full text-left flex justify-between items-center px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-sm"
                    onClick={() => setDate(r.date)}
                  >
                    <span className="font-medium text-slate-700">{r.date}</span>
                    <span className="text-slate-500">{present}/{total} present</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
