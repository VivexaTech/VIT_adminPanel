"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import PageHeader from "@/components/ui/PageHeader";
import RecordingFormModal from "@/components/admin/recordings/RecordingFormModal";
import { subscribeToRecordings } from "@/lib/recordingService";
import { adminApi } from "@/lib/adminApi";
import { subscribeToBatches } from "@/lib/batchService";
import { subscribeToCourses } from "@/lib/courseService";
import { useToast } from "@/context/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { btnPrimary, inputClass, tableCard } from "@/lib/theme";
import { formatDuration, formatFileSize } from "@/lib/cloudinary";
import {
  Film,
  Plus,
  Trash2,
  Pencil,
  Copy,
  ExternalLink,
  Search,
  Play,
} from "lucide-react";
import type { Recording } from "@/types/erp";
import type { Batch } from "@/types/erp";
import type { Course } from "@/types/course";

type SortKey = "latest" | "oldest" | "title";

export default function RecordingsPage() {
  const { showToast } = useToast();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recording | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recording | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");

  useEffect(() => {
    subscribeToRecordings(setRecordings);
    subscribeToBatches(setBatches);
    subscribeToCourses(setCourses);
  }, []);

  const filtered = useMemo(() => {
    let list = [...recordings];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.topic?.toLowerCase().includes(q) ||
          r.courseTitle?.toLowerCase().includes(q)
      );
    }
    if (courseFilter) list = list.filter((r) => r.courseId === courseFilter);
    if (batchFilter) list = list.filter((r) => r.batchId === batchFilter);

    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "oldest") return (a.uploadDate || "").localeCompare(b.uploadDate || "");
      return (b.uploadDate || "").localeCompare(a.uploadDate || "");
    });
    return list;
  }, [recordings, search, courseFilter, batchFilter, sort]);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "URL copied to clipboard.");
    } catch {
      showToast("error", "Could not copy URL.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteRecording(deleteTarget.id);
      showToast("success", "Recording deleted from Firestore and Cloudinary.");
      setDeleteTarget(null);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Class Recordings"
        subtitle="Upload videos directly to Cloudinary and assign to batches."
        icon={<Film className="text-[#6C3CE9]" size={26} />}
        actions={
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} /> Upload Recording
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className={inputClass + " pl-10"}
            placeholder="Search by title or topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputClass + " sm:w-44"} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className={inputClass + " sm:w-44"} value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className={inputClass + " sm:w-40"} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="latest">Latest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className={tableCard + " hidden lg:block overflow-x-auto"}>
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="border-b bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Recording</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  No recordings yet. Upload your first class recording.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      {r.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="text-white/60" size={16} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{r.title}</p>
                      {r.topic && <p className="text-xs text-slate-500">{r.topic}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm">{r.courseTitle || "—"}</td>
                <td className="px-5 py-4 text-sm">{r.batchName || "—"}</td>
                <td className="px-5 py-4 text-sm">{r.uploadDate}</td>
                <td className="px-5 py-4 text-sm">
                  {r.durationLabel || formatDuration(r.duration)}
                  <span className="text-slate-400 block text-xs">
                    {r.fileSizeLabel || formatFileSize(r.fileSize)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    <a
                      href={r.secureVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-[#6C3CE9]"
                      title="View"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => copyUrl(r.secureVideoUrl)}
                      className="p-2 text-slate-400 hover:text-[#6C3CE9]"
                      title="Copy URL"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(r);
                        setFormOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-[#6C3CE9]"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-2 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-4">
        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center text-slate-500">
            No recordings yet. Upload your first class recording.
          </div>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="glass-card rounded-2xl p-4">
            <div className="flex gap-3">
              <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                {r.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="text-white/60" size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{r.title}</p>
                <p className="text-sm text-slate-500">{r.courseTitle}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {r.uploadDate} • {r.durationLabel || formatDuration(r.duration)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              <a
                href={r.secureVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-center py-2 text-sm font-medium text-[#6C3CE9] bg-purple-50 rounded-xl"
              >
                View
              </a>
              <button
                type="button"
                onClick={() => {
                  setEditing(r);
                  setFormOpen(true);
                }}
                className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(r)}
                className="px-4 py-2 text-red-500 bg-red-50 rounded-xl"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <RecordingFormModal
        open={formOpen}
        courses={courses}
        batches={batches}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {}}
        onError={(msg) => showToast("error", msg)}
        onSuccess={(msg) => showToast("success", msg)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Recording"
        message="This will permanently delete the video from Cloudinary and remove it from all student accounts."
        destructive
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </PageTransition>
  );
}
