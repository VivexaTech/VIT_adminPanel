"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  btnPrimary,
  btnSecondary,
  formGrid,
  inputClass,
  labelClass,
  modalBody,
  modalFooter,
  modalHeader,
  modalOverlay,
  modalPanelMd,
  textareaClass,
} from "@/lib/theme";
import {
  INQUIRY_STATUSES,
  NEXT_ACTION_OPTIONS,
  type Inquiry,
  type InquiryStatus,
} from "@/types/inquiry";

type Props = {
  open: boolean;
  inquiry: Inquiry | null;
  onClose: () => void;
  onSubmit: (data: {
    note: string;
    nextFollowUpDate?: string;
    nextAction?: string;
    contactDate?: string;
    status?: InquiryStatus;
  }) => Promise<void>;
};

export default function FollowUpModal({ open, inquiry, onClose, onSubmit }: Props) {
  const [note, setNote] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [contactDate, setContactDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<InquiryStatus | "">("");
  const [saving, setSaving] = useState(false);

  if (!open || !inquiry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        note,
        nextFollowUpDate: nextFollowUpDate || undefined,
        nextAction: nextAction || undefined,
        contactDate,
        status: status || undefined,
      });
      setNote("");
      setNextFollowUpDate("");
      setNextAction("");
      setStatus("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={modalOverlay}>
      <div className={modalPanelMd}>
        <div className={modalHeader}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Follow-up</h2>
            <p className="text-xs text-slate-500">
              {inquiry.inquiryId} · {inquiry.fullName}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className={modalBody + " space-y-4"}>
            <div>
              <label className={labelClass}>Follow-up Note *</label>
              <textarea
                required
                className={textareaClass}
                rows={4}
                placeholder="Called student. Interested in Python course..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className={formGrid}>
              <div>
                <label className={labelClass}>Contact Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={contactDate}
                  onChange={(e) => setContactDate(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Next Follow-up Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Next Action</label>
                <select
                  className={inputClass}
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                >
                  <option value="">Select</option>
                  {NEXT_ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Update Status</label>
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InquiryStatus | "")}
                >
                  <option value="">Keep current ({inquiry.status})</option>
                  {INQUIRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className={modalFooter}>
            <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving || !note.trim()}>
              {saving ? "Saving..." : "Save Follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
