"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { useToast } from "@/context/ToastContext";
import { subscribeToBatches } from "@/lib/batchService";
import {
  subscribeToClassSessions,
  createClassSessionFromBatch,
  updateClassSessionStatus,
} from "@/lib/classSessionService";
import { btnPrimary, btnPrimaryBlock, btnSecondary, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import { Video, Play, Square, Plus } from "lucide-react";
import type { Batch, ClassSession } from "@/types/erp";

export default function ClassesPage() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    return subscribeToBatches(setBatches);
  }, []);

  useEffect(() => {
    return subscribeToClassSessions(setSessions);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || !topic.trim()) {
      showToast("error", "Select batch and enter topic.");
      return;
    }
    try {
      await createClassSessionFromBatch(batch, topic.trim(), date);
      showToast("success", "Class session created from batch schedule.");
      setShowForm(false);
      setTopic("");
    } catch {
      showToast("error", "Failed to create session.");
    }
  };

  return (
    <PageTransition>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Video className="text-[#6C3CE9]" size={26} /> Live Classes
          </h1>
          <p className="text-slate-500 text-sm mt-1">Start/end live sessions. Timing and links come from assigned batches.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setShowForm(true)}><Plus size={18} /> Schedule Class</button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Topic</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch / Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No class sessions yet.</td></tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="px-5 py-4 font-medium">{s.topic}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{s.batchName} · {s.courseTitle}</td>
                  <td className="px-5 py-4 text-sm">{s.date}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      s.status === "live" ? "bg-red-100 text-red-600" :
                      s.status === "completed" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-600"
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-1">
                    {s.status !== "live" && s.status !== "completed" && (
                      <button className={btnSecondary + " !py-1.5 !px-3 text-sm"} onClick={async () => {
                        await updateClassSessionStatus(s.id, "live");
                        showToast("success", "Class is now LIVE for students.");
                      }}><Play size={14} /> Start</button>
                    )}
                    {s.status === "live" && (
                      <button className={btnPrimary + " !py-1.5 !px-3 text-sm"} onClick={async () => {
                        await updateClassSessionStatus(s.id, "completed");
                        showToast("success", "Class ended.");
                      }}><Square size={14} /> End</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleCreate} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-900">Schedule Class (from Batch)</h3>
            <div>
              <label className={labelClass}>Batch</label>
              <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
                <option value="">Select batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.courseTitle}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Topic</label><input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} required /></div>
            <div><label className={labelClass}>Date</label><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" className={btnSecondaryBlock} onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className={btnPrimaryBlock}>Create</button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
