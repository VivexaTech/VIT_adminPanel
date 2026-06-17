"use client";

import { useEffect, useState } from "react";
import VideoUploadField from "@/components/admin/recordings/VideoUploadField";
import { useAuth } from "@/context/AuthContext";
import { upsertRecording } from "@/lib/recordingService";
import type { CloudinaryVideoUploadResult, RecordingUploadCategory } from "@/lib/cloudinary";
import {
  btnPrimaryBlock,
  btnSecondaryBlock,
  inputClass,
  labelClass,
  modalFooter,
  modalPanel,
} from "@/lib/theme";
import type { Recording } from "@/types/erp";
import type { Batch } from "@/types/erp";
import type { Course } from "@/types/course";

type Props = {
  open: boolean;
  courses: Course[];
  batches: Batch[];
  initial?: Recording | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
};

export default function RecordingFormModal({
  open,
  courses,
  batches,
  initial,
  onClose,
  onSaved,
  onError,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const isEdit = Boolean(initial?.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<RecordingUploadCategory>("course");
  const [upload, setUpload] = useState<CloudinaryVideoUploadResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setCourseId(initial?.courseId || "");
    setBatchId(initial?.batchId || "");
    setTopic(initial?.topic || "");
    setCategory((initial?.recordingCategory as RecordingUploadCategory) || "course");
    if (initial?.secureVideoUrl && initial.cloudinaryPublicId) {
      setUpload({
        videoId: initial.videoId || initial.cloudinaryPublicId,
        cloudinaryPublicId: initial.cloudinaryPublicId,
        secureVideoUrl: initial.secureVideoUrl,
        thumbnailUrl: initial.thumbnailUrl || "",
        duration: initial.duration || 0,
        fileSize: initial.fileSize || 0,
      });
    } else {
      setUpload(null);
    }
  }, [open, initial]);

  const filteredBatches = batches.filter((b) => !courseId || b.courseId === courseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !courseId) {
      onError("Title and course are required.");
      return;
    }
    if (!upload && !isEdit) {
      onError("Please upload a video file.");
      return;
    }
    if (isEdit && !upload) {
      onError("Recording video is missing.");
      return;
    }

    setSaving(true);
    try {
      const course = courses.find((c) => c.id === courseId);
      const batch = batches.find((b) => b.id === batchId);
      await upsertRecording(
        {
          id: initial?.id,
          title: title.trim(),
          description: description.trim(),
          courseId,
          courseTitle: course?.title,
          batchId: batchId || undefined,
          batchName: batch?.name,
          topic: topic.trim() || undefined,
          recordingCategory: category,
          videoId: upload!.videoId,
          cloudinaryPublicId: upload!.cloudinaryPublicId,
          secureVideoUrl: upload!.secureVideoUrl,
          thumbnailUrl: upload!.thumbnailUrl,
          duration: upload!.duration,
          fileSize: upload!.fileSize,
          uploadDate: initial?.uploadDate || new Date().toISOString().slice(0, 10),
          uploadedBy: user?.email || "",
          createdBy: initial?.createdBy || user?.email || "",
        },
        { previousBatchId: initial?.batchId }
      );
      onSuccess(isEdit ? "Recording updated." : "Recording published to students.");
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes("permission")
            ? "Permission denied. Check that you are logged in as an active admin."
            : err.message
          : "Failed to save recording.";
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={handleSubmit} className={modalPanel + " w-full sm:max-w-lg space-y-4"}>
        <h3 className="text-lg font-bold text-slate-900">
          {isEdit ? "Edit Recording" : "Upload Recording"}
        </h3>

        {!isEdit && (
          <VideoUploadField category={category} value={upload} onChange={setUpload} disabled={saving} />
        )}

        {isEdit && upload && (
          <div className="text-sm text-slate-500 rounded-xl bg-slate-50 p-3 border border-slate-100">
            Video is uploaded. To replace, delete and create a new recording.
          </div>
        )}

        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass + " min-h-[80px]"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional class summary"
          />
        </div>
        <div>
          <label className={labelClass}>Recording Type</label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as RecordingUploadCategory)}
            disabled={isEdit}
          >
            <option value="course">Course Recording</option>
            <option value="live_class">Live Class Recording</option>
            <option value="general">General</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Course</label>
          <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
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
          <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">No batch (admin only)</option>
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Assign a batch so enrolled students receive this recording.</p>
        </div>
        <div>
          <label className={labelClass}>Topic</label>
          <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. React Hooks" />
        </div>

        <div className={modalFooter}>
          <button type="button" onClick={onClose} className={btnSecondaryBlock} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={btnPrimaryBlock} disabled={saving || (!isEdit && !upload)}>
            {saving ? "Saving…" : isEdit ? "Update" : "Publish Recording"}
          </button>
        </div>
      </form>
    </div>
  );
}
