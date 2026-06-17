"use client";

import { Copy, Check, X } from "lucide-react";
import { useState } from "react";
import { btnPrimaryBlock } from "@/lib/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  rows: { label: string; value: string }[];
  notice?: string;
};

export default function CredentialsModal({ open, onClose, title, subtitle, rows, notice }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const copyAll = async () => {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{row.label}</p>
              <p className="font-mono text-sm text-slate-900 mt-1 break-all">{row.value}</p>
            </div>
          ))}
          {notice && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{notice}</p>
          )}
        </div>
        <div className="p-5 pt-0 flex flex-col gap-2">
          <button type="button" onClick={copyAll} className={btnPrimaryBlock}>
            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy Credentials</>}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 py-2 hover:text-slate-800">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
