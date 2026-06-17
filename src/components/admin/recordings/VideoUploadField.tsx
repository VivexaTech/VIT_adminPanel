"use client";

import { useCallback, useRef, useState } from "react";
import { Film, Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import {
  uploadVideoToCloudinary,
  type CloudinaryVideoUploadResult,
  type RecordingUploadCategory,
} from "@/lib/cloudinary";

type Props = {
  category: RecordingUploadCategory;
  value: CloudinaryVideoUploadResult | null;
  onChange: (result: CloudinaryVideoUploadResult | null) => void;
  disabled?: boolean;
};

export default function VideoUploadField({ category, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setProgress(0);
      try {
        const result = await uploadVideoToCloudinary(file, {
          category,
          onProgress: setProgress,
        });
        onChange(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        onChange(null);
      } finally {
        setUploading(false);
      }
    },
    [category, onChange]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-600 block">
        Video File <span className="text-red-500">*</span>
      </label>
      <p className="text-xs text-slate-500">MP4, WebM, or MOV — max 500 MB. Uploads directly to Cloudinary.</p>

      {!value && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? "border-[#6C3CE9] bg-purple-50"
              : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
          } ${disabled || uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="mx-auto animate-spin text-[#6C3CE9]" size={36} />
              <p className="font-semibold text-slate-700">Uploading… {progress}%</p>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-[#6C3CE9] to-[#9B5DE5] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="mx-auto text-slate-400 mb-3" size={32} />
              <p className="font-semibold text-slate-700">Drag & drop video here</p>
              <p className="text-sm text-slate-500 mt-1">or click to browse</p>
            </>
          )}
        </div>
      )}

      {value && (
        <div className="flex gap-4 p-4 rounded-2xl border border-green-200 bg-green-50/50">
          <div className="w-28 h-16 rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
            {value.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
            ) : (
              <Film className="text-white/70" size={28} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-1">
              <CheckCircle2 size={16} /> Upload complete
            </div>
            <p className="text-xs text-slate-600 truncate">{value.cloudinaryPublicId}</p>
            <p className="text-xs text-slate-500 mt-1">
              {Math.round(value.duration)}s • {(value.fileSize / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="p-2 text-slate-400 hover:text-red-500 self-start"
              title="Remove and re-upload"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
