"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/context/ToastContext";
import { adminApi } from "@/lib/adminApi";
import { filterBatchesForTrainer, subscribeToBatches } from "@/lib/batchService";
import {
  createClassSessionFromBatch,
  subscribeToClassSessions,
  updateClassSessionStatus,
} from "@/lib/classSessionService";
import { subscribeToCourses } from "@/lib/courseService";
import {
  btnPrimary,
  btnPrimaryBlock,
  btnSecondary,
  btnSecondaryBlock,
  formGrid,
  inputClass,
  labelClass,
  modalFooter,
  modalOverlay,
  modalPanelMd,
  textareaClass,
} from "@/lib/theme";
import { Play, Plus, Square, Video, X } from "lucide-react";
import type { AdminLiveClass, LiveClassUiStatus } from "@/types/liveClass";
import type { Batch, ClassSession } from "@/types/erp";
import type { Course } from "@/types/course";

type Tab = "upcoming" | "live" | "completed" | "recordings";

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultTimes() {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { startTime: toLocalInput(start), endTime: toLocalInput(end) };
}

function formatWhen(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: LiveClassUiStatus) {
  if (status === "waiting_for_teacher") return "Waiting for stream";
  if (status === "live") return "Live now";
  return status.replaceAll("_", " ");
}

function statusClass(status: LiveClassUiStatus) {
  if (status === "live") return "bg-red-100 text-red-600";
  if (status === "waiting_for_teacher") return "bg-amber-100 text-amber-700";
  if (status === "upcoming") return "bg-blue-100 text-blue-600";
  if (status === "cancelled") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-600";
}

export default function ClassesPage() {
  const { user } = useAuth();
  const { isTrainer } = usePermissions();
  const { showToast } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [liveClasses, setLiveClasses] = useState<AdminLiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [startTime, setStartTime] = useState(defaultTimes().startTime);
  const [endTime, setEndTime] = useState(defaultTimes().endTime);
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [recordingEnabled, setRecordingEnabled] = useState(true);

  const [confirmEnd, setConfirmEnd] = useState<AdminLiveClass | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<AdminLiveClass | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showMeetForm, setShowMeetForm] = useState(false);
  const [meetBatchId, setMeetBatchId] = useState("");
  const [meetTopic, setMeetTopic] = useState("");
  const [meetDate, setMeetDate] = useState(new Date().toISOString().slice(0, 10));

  const visibleBatches = useMemo(
    () => (isTrainer ? filterBatchesForTrainer(batches, user?.assignedBatchIds) : batches),
    [batches, isTrainer, user?.assignedBatchIds]
  );

  const formBatches = useMemo(
    () => (courseId ? visibleBatches.filter((b) => b.courseId === courseId) : visibleBatches),
    [visibleBatches, courseId]
  );

  const loadLiveClasses = useCallback(async () => {
    try {
      const data = await adminApi.listLiveClasses();
      setLiveClasses(Array.isArray(data.liveClasses) ? data.liveClasses : []);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to load live classes.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const unsubs = [
      subscribeToBatches(setBatches),
      subscribeToCourses(setCourses),
      subscribeToClassSessions(setSessions),
    ];
    void loadLiveClasses();
    return () => unsubs.forEach((u) => u());
  }, [loadLiveClasses]);

  const openSchedule = () => {
    const times = defaultTimes();
    setTitle("");
    setCourseId("");
    setBatchId("");
    setTeacherName(user?.fullName || "");
    setStartTime(times.startTime);
    setEndTime(times.endTime);
    setDescription("");
    setYoutubeUrl("");
    setRecordingEnabled(true);
    setShowForm(true);
  };

  const filteredClasses = useMemo(() => {
    return liveClasses.filter((item) => {
      if (tab === "upcoming") return item.uiStatus === "upcoming" || item.uiStatus === "waiting_for_teacher";
      if (tab === "live") return item.uiStatus === "live";
      if (tab === "completed") return item.uiStatus === "completed" || item.uiStatus === "cancelled";
      return item.recordingEnabled && item.recordingStatus !== "disabled";
    });
  }, [liveClasses, tab]);

  const counts = useMemo(
    () => ({
      upcoming: liveClasses.filter((item) => item.uiStatus === "upcoming" || item.uiStatus === "waiting_for_teacher").length,
      live: liveClasses.filter((item) => item.uiStatus === "live").length,
      completed: liveClasses.filter((item) => item.uiStatus === "completed" || item.uiStatus === "cancelled").length,
      recordings: liveClasses.filter((item) => item.recordingEnabled && item.recordingStatus !== "disabled").length,
    }),
    [liveClasses]
  );

  const meetSessions = useMemo(
    () =>
      isTrainer
        ? sessions.filter((s) =>
            visibleBatches.some((b) => b.id === s.batchId || b.batchId === s.batchId)
          )
        : sessions,
    [isTrainer, sessions, visibleBatches]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = visibleBatches.find((b) => b.id === batchId);
    const course = courses.find((c) => c.id === courseId || c.courseId === courseId);
    if (!title.trim() || !courseId || !batch) {
      showToast("error", "Enter a title and select course and batch.");
      return;
    }
    if (!youtubeUrl.trim()) {
      showToast("error", "Paste the YouTube live or embed link.");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createLiveClass({
        title: title.trim(),
        courseId: course?.id || courseId,
        courseTitle: course?.title || batch.courseTitle,
        teacherName: teacherName.trim() || user?.fullName || "Trainer",
        batchIds: [...new Set([batch.id, batch.batchId].filter(Boolean))],
        batchName: batch.name,
        description: description.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        recordingEnabled,
        youtubeUrl: youtubeUrl.trim(),
      });
      setShowForm(false);
      showToast("success", "Live class scheduled. Students will watch it inside the portal.");
      await loadLiveClasses();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to schedule live class.");
    } finally {
      setSaving(false);
    }
  };

  const handleEnd = async () => {
    if (!confirmEnd) return;
    setBusyId(confirmEnd.id);
    try {
      await adminApi.endLiveClass(confirmEnd.id);
      showToast("success", "Live class ended. Students can no longer join.");
      setConfirmEnd(null);
      await loadLiveClasses();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to end class.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setBusyId(confirmCancel.id);
    try {
      await adminApi.cancelLiveClass(confirmCancel.id);
      showToast("success", "Live class cancelled.");
      setConfirmCancel(null);
      await loadLiveClasses();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to cancel class.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMeetCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = visibleBatches.find((b) => b.id === meetBatchId);
    if (!batch || !meetTopic.trim()) {
      showToast("error", "Select batch and enter topic.");
      return;
    }
    try {
      await createClassSessionFromBatch(batch, meetTopic.trim(), meetDate);
      showToast("success", "Google Meet session created from batch schedule.");
      setShowMeetForm(false);
      setMeetTopic("");
    } catch {
      showToast("error", "Failed to create Meet session.");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
    { id: "live", label: `Live now (${counts.live})` },
    { id: "completed", label: `Completed (${counts.completed})` },
    { id: "recordings", label: `Recordings (${counts.recordings})` },
  ];

  return (
    <PageTransition>
      <PageHeader
        icon={<Video className="text-[#6C3CE9]" size={26} />}
        title="Live Classes"
        subtitle="Paste a YouTube live link. Enrolled students watch it inside the Vivexa portal classroom."
        actions={
          <button type="button" className={btnPrimary} onClick={openSchedule}>
            <Plus size={18} /> Schedule Live Class
          </button>
        }
      />

      <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-[#6C3CE9] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden mb-8">
        <table className="w-full text-left min-w-[920px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Class</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch / Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Schedule</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  Loading live classes…
                </td>
              </tr>
            ) : filteredClasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  {tab === "upcoming"
                    ? "No upcoming in-portal live classes."
                    : tab === "live"
                      ? "No class is live right now."
                      : tab === "recordings"
                        ? "No live-class recordings yet."
                        : "No completed live classes."}
                </td>
              </tr>
            ) : (
              filteredClasses.map((item) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.teacherName}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {item.batchName || "Batch"} · {item.courseTitle || item.courseId}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    <div>{formatWhen(item.startTime)}</div>
                    <div className="text-xs text-slate-400">to {formatWhen(item.endTime)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass(item.uiStatus)}`}>
                      {statusLabel(item.uiStatus)}
                    </span>
                    {item.recordingEnabled && (
                      <p className="text-[11px] text-slate-400 mt-1 capitalize">
                        Recording {item.recordingStatus}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                    {(item.uiStatus === "live" || item.uiStatus === "waiting_for_teacher") && (
                      <button
                        type="button"
                        className={btnPrimary + " !py-1.5 !px-3 text-sm"}
                        onClick={() => setConfirmEnd(item)}
                      >
                        <Square size={14} /> End
                      </button>
                    )}
                    {item.uiStatus === "upcoming" && (
                      <button
                        type="button"
                        className={btnSecondary + " !py-1.5 !px-3 text-sm"}
                        onClick={() => setConfirmCancel(item)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Google Meet sessions (legacy)</h2>
          <p className="text-slate-500 text-sm mt-1">Existing Meet start/end flow. New classes should use a YouTube link above.</p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => setShowMeetForm(true)}>
          <Plus size={16} /> Meet session
        </button>
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
            {meetSessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  No Google Meet sessions yet.
                </td>
              </tr>
            ) : (
              meetSessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="px-5 py-4 font-medium">{s.topic}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {s.batchName} · {s.courseTitle}
                  </td>
                  <td className="px-5 py-4 text-sm">{s.date}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        s.status === "live"
                          ? "bg-red-100 text-red-600"
                          : s.status === "completed"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-1">
                    {s.status !== "live" && s.status !== "completed" && (
                      <button
                        className={btnSecondary + " !py-1.5 !px-3 text-sm"}
                        onClick={async () => {
                          await updateClassSessionStatus(s.id, "live");
                          showToast("success", "Class is now LIVE for students.");
                        }}
                      >
                        <Play size={14} /> Start
                      </button>
                    )}
                    {s.status === "live" && (
                      <button
                        className={btnPrimary + " !py-1.5 !px-3 text-sm"}
                        onClick={async () => {
                          await updateClassSessionStatus(s.id, "completed");
                          showToast("success", "Class ended.");
                        }}
                      >
                        <Square size={14} /> End
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className={modalOverlay}>
          <form onSubmit={handleCreate} className={`${modalPanelMd} p-0`}>
            <div className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Schedule in-portal live class</h3>
                <p className="text-sm text-slate-500 mt-1">Paste the YouTube live, watch, or embed link. Students join from the portal — they are not sent to youtube.com.</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600 p-1" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className={labelClass}>Class title</label>
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className={formGrid}>
                <div>
                  <label className={labelClass}>Course</label>
                  <select
                    className={inputClass}
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      setBatchId("");
                    }}
                    required
                  >
                    <option value="">Select course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Batch</label>
                  <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
                    <option value="">Select batch</option>
                    {formBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.courseTitle}
                      </option>
                    ))}
                  </select>
                  {formBatches.length === 0 && (
                    <p className="text-xs text-amber-700 mt-1.5">
                      {isTrainer && visibleBatches.length === 0
                        ? "No batches are assigned to this trainer account."
                        : "Select a course that has a batch, or create a batch first."}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Trainer</label>
                  <input className={inputClass} value={teacherName} onChange={(e) => setTeacherName(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>Start</label>
                  <input type="datetime-local" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>End</label>
                  <input type="datetime-local" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className={labelClass}>YouTube live / embed link</label>
                <input
                  className={inputClass}
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/live/... or /watch?v=..."
                  required
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  In YouTube Studio go live (Unlisted recommended), then paste the share or embed link here.
                </p>
              </div>
              <div>
                <label className={labelClass}>Description (optional)</label>
                <textarea className={textareaClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={recordingEnabled}
                  onChange={(e) => setRecordingEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-[#6C3CE9] focus:ring-[#6C3CE9]"
                />
                Keep this YouTube video available after class for enrolled students
              </label>
            </div>
            <div className={modalFooter}>
              <button type="button" className={btnSecondaryBlock} onClick={() => setShowForm(false)}>
                Close
              </button>
              <button type="submit" className={btnPrimaryBlock} disabled={saving}>
                {saving ? "Scheduling…" : "Schedule class"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showMeetForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleMeetCreate} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-900">Schedule Google Meet class</h3>
            <div>
              <label className={labelClass}>Batch</label>
              <select className={inputClass} value={meetBatchId} onChange={(e) => setMeetBatchId(e.target.value)} required>
                <option value="">Select batch</option>
                {visibleBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.courseTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Topic</label>
              <input className={inputClass} value={meetTopic} onChange={(e) => setMeetTopic(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" className={inputClass} value={meetDate} onChange={(e) => setMeetDate(e.target.value)} />
            </div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" className={btnSecondaryBlock} onClick={() => setShowMeetForm(false)}>
                Cancel
              </button>
              <button type="submit" className={btnPrimaryBlock}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmEnd)}
        title="End live class?"
        message="Students will no longer be able to join this live classroom."
        confirmLabel="End class"
        destructive
        loading={Boolean(confirmEnd && busyId === confirmEnd.id)}
        onConfirm={() => void handleEnd()}
        onCancel={() => setConfirmEnd(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmCancel)}
        title="Cancel this class?"
        message="Students will no longer see this class as joinable."
        confirmLabel="Cancel class"
        destructive
        loading={Boolean(confirmCancel && busyId === confirmCancel.id)}
        onConfirm={() => void handleCancel()}
        onCancel={() => setConfirmCancel(null)}
      />
    </PageTransition>
  );
}
