"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  hint?: string;
};

export default function ImageUploadField({
  label,
  value,
  onChange,
  required,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
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
      <label className="text-sm font-medium text-gray-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-40 h-28 rounded-xl border border-cyan-500/20 bg-[#050B14] overflow-hidden flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="text-gray-600" size={32} />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
            placeholder="Paste image URL or upload below"
            className="w-full px-4 py-2.5 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
          />
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? `Uploading ${progress}%` : "Upload Image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 text-sm"
              >
                <X size={16} /> Clear
              </button>
            )}
          </div>
          {uploading && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
