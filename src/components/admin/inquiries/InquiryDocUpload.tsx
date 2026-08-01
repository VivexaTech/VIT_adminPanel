"use client";

import { useRef, useState } from "react";
import { FileImage, Loader2, Upload, X } from "lucide-react";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { inputClass, labelClass } from "@/lib/theme";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
};

export default function InquiryDocUpload({ label, value, onChange, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please select an image or PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be smaller than 5 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadImageToCloudinary(file, setProgress);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">
      <label className={labelClass}>{label}</label>
      {hint ? <p className="text-xs text-slate-400 -mt-1">{hint}</p> : null}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-28 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <FileImage className="text-slate-300" size={28} />
          )}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
            placeholder="Paste URL or upload"
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? `${progress}%` : "Upload"}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="p-1.5 text-slate-400 hover:text-red-500"
                aria-label="Clear"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
