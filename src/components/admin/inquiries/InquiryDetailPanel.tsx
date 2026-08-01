"use client";

import {
  Bell,
  CalendarClock,
  GraduationCap,
  Phone,
  Pencil,
  StickyNote,
} from "lucide-react";
import {
  formatInquiryDateTime,
  isFollowUpOverdue,
} from "@/lib/inquiryService";
import {
  INQUIRY_PRIORITIES,
  INQUIRY_PRIORITY_STYLES,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_STYLES,
  type Inquiry,
  type InquiryPriority,
  type InquiryStatus,
} from "@/types/inquiry";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/theme";

type Props = {
  inquiry: Inquiry | null;
  onEdit: () => void;
  onFollowUp: () => void;
  onStatusChange: (status: InquiryStatus) => void;
  onPriorityChange: (priority: InquiryPriority) => void;
  onConvert: () => void;
  onSetReminder: () => void;
};

export default function InquiryDetailPanel({
  inquiry,
  onEdit,
  onFollowUp,
  onStatusChange,
  onPriorityChange,
  onConvert,
  onSetReminder,
}: Props) {
  if (!inquiry) {
    return (
      <div className="glass-card rounded-2xl p-6 h-fit">
        <p className="text-sm text-slate-400 text-center py-10">
          Select an inquiry to view details and take actions.
        </p>
      </div>
    );
  }

  const overdue = isFollowUpOverdue(inquiry);
  const history = [...(inquiry.followUpHistory || [])].reverse();

  return (
    <div className="glass-card rounded-2xl p-5 h-fit space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-mono text-[#6C3CE9]">{inquiry.inquiryId}</p>
          <h2 className="font-semibold text-slate-900 text-lg mt-0.5">{inquiry.fullName}</h2>
          <a href={`tel:${inquiry.phone}`} className="text-sm text-[#6C3CE9] inline-flex items-center gap-1 mt-1">
            <Phone size={14} /> {inquiry.phone}
          </a>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${INQUIRY_STATUS_STYLES[inquiry.status]}`}>
          {inquiry.status}
        </span>
      </div>

      {overdue ? (
        <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          <CalendarClock size={14} /> Follow-up overdue ({inquiry.nextFollowUpDate})
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-400 text-xs">Course</p>
          <p className="font-medium text-slate-800">{inquiry.courseTitle || "—"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Source</p>
          <p className="font-medium text-slate-800">{inquiry.source || "—"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Education</p>
          <p className="font-medium text-slate-800">{inquiry.educationStatus || "—"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Occupation</p>
          <p className="font-medium text-slate-800">{inquiry.occupation || "—"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Created</p>
          <p className="font-medium text-slate-800">{formatInquiryDateTime(inquiry)}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Created By</p>
          <p className="font-medium text-slate-800">{inquiry.createdByName || "—"}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Next Follow-up</p>
          <p className={`font-medium ${overdue ? "text-red-600" : "text-slate-800"}`}>
            {inquiry.nextFollowUpDate || "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Follow-ups</p>
          <p className="font-medium text-slate-800">{inquiry.followUpCount}</p>
        </div>
      </div>

      {inquiry.description ? (
        <div>
          <p className="text-xs text-slate-400 mb-1">Description</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{inquiry.description}</p>
        </div>
      ) : null}

      {inquiry.internalNotes ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="text-xs text-slate-400 mb-1 inline-flex items-center gap-1">
            <StickyNote size={12} /> Internal Notes
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{inquiry.internalNotes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={inquiry.status}
            onChange={(e) => onStatusChange(e.target.value as InquiryStatus)}
          >
            {INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select
            className={inputClass}
            value={inquiry.priority}
            onChange={(e) => onPriorityChange(e.target.value as InquiryPriority)}
          >
            {INQUIRY_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className={btnSecondary + " text-xs py-1.5 px-3"}>
          <Pencil size={14} /> Edit
        </button>
        <button type="button" onClick={onFollowUp} className={btnSecondary + " text-xs py-1.5 px-3"}>
          <CalendarClock size={14} /> Follow-up
        </button>
        <button type="button" onClick={onSetReminder} className={btnSecondary + " text-xs py-1.5 px-3"}>
          <Bell size={14} /> Reminder
        </button>
        {inquiry.status !== "Admission Confirmed" ? (
          <button type="button" onClick={onConvert} className={btnPrimary + " text-xs py-1.5 px-3"}>
            <GraduationCap size={14} /> Convert to Admission
          </button>
        ) : (
          <span className="text-xs text-emerald-600 font-medium self-center">
            Linked admission: {inquiry.admissionId || "confirmed"}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Follow-up History</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">No follow-ups yet.</p>
        ) : (
          <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-[#6C3CE9]/40 pl-3 py-0.5">
                <p className="text-xs text-slate-400">
                  {h.contactDate || h.createdAt.slice(0, 10)}
                  {h.createdByName ? ` · ${h.createdByName}` : ""}
                </p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap mt-0.5">{h.note}</p>
                {(h.nextAction || h.nextFollowUpDate) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {h.nextAction ? `Next: ${h.nextAction}` : ""}
                    {h.nextFollowUpDate ? ` · ${h.nextFollowUpDate}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(inquiry.studentPhotoUrl || inquiry.aadhaarUrl) && (
        <div className="flex gap-3">
          {inquiry.studentPhotoUrl ? (
            <a href={inquiry.studentPhotoUrl} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inquiry.studentPhotoUrl}
                alt="Student"
                className="w-16 h-16 rounded-lg object-cover border border-slate-200"
              />
            </a>
          ) : null}
          {inquiry.aadhaarUrl ? (
            <a
              href={inquiry.aadhaarUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#6C3CE9] self-center underline"
            >
              View Aadhaar
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: InquiryPriority }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INQUIRY_PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  );
}
