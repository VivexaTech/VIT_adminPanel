"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  btnPrimary,
  btnSecondary,
  formGrid,
  formGridFull,
  inputClass,
  labelClass,
  modalBody,
  modalFooter,
  modalHeader,
  modalOverlay,
  modalPanelLg,
  textareaClass,
} from "@/lib/theme";
import {
  EDUCATION_OPTIONS,
  INQUIRY_PRIORITIES,
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  NEXT_ACTION_OPTIONS,
  OCCUPATION_OPTIONS,
  type Inquiry,
  type InquiryFormInput,
  type InquiryGender,
} from "@/types/inquiry";
import type { Course } from "@/types/course";
import InquiryDocUpload from "./InquiryDocUpload";
import { findInquiriesByPhone } from "@/lib/inquiryService";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InquiryFormInput) => Promise<void>;
  courses: Course[];
  initial?: Inquiry | null;
  title?: string;
};

const empty: InquiryFormInput = {
  fullName: "",
  age: null,
  gender: "",
  phone: "",
  email: "",
  educationStatus: "",
  occupation: "",
  courseId: "",
  courseTitle: "",
  source: "Offline",
  studentPhotoUrl: "",
  aadhaarUrl: "",
  description: "",
  internalNotes: "",
  status: "New",
  priority: "Medium",
  nextFollowUpDate: "",
  nextAction: "",
};

export default function InquiryFormModal({
  open,
  onClose,
  onSubmit,
  courses,
  initial,
  title,
}: Props) {
  const [form, setForm] = useState<InquiryFormInput>(empty);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Inquiry[]>([]);
  const [forceContinue, setForceContinue] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fullName: initial.fullName,
        age: initial.age ?? null,
        gender: initial.gender || "",
        phone: initial.phone,
        email: initial.email || "",
        educationStatus: initial.educationStatus || "",
        occupation: initial.occupation || "",
        courseId: initial.courseId || "",
        courseTitle: initial.courseTitle || "",
        source: initial.source || "Offline",
        studentPhotoUrl: initial.studentPhotoUrl || "",
        aadhaarUrl: initial.aadhaarUrl || "",
        description: initial.description || "",
        internalNotes: initial.internalNotes || "",
        status: initial.status,
        priority: initial.priority,
        nextFollowUpDate: initial.nextFollowUpDate || "",
        nextAction: initial.nextAction || "",
      });
    } else {
      setForm(empty);
    }
    setDuplicates([]);
    setForceContinue(false);
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof InquiryFormInput>(key: K, value: InquiryFormInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleCourseChange = (courseId: string) => {
    const course = courses.find((c) => (c.courseId || c.id) === courseId);
    setForm((f) => ({
      ...f,
      courseId,
      courseTitle: course?.title || "",
    }));
  };

  const checkDuplicates = async () => {
    if (initial) return [];
    const found = await findInquiriesByPhone(form.phone);
    setDuplicates(found);
    return found;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) return;

    setSaving(true);
    try {
      if (!initial && !forceContinue) {
        const found = await checkDuplicates();
        if (found.length > 0) {
          setSaving(false);
          return;
        }
      }
      await onSubmit({
        ...form,
        nextFollowUpDate: form.nextFollowUpDate || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={modalOverlay}>
      <div className={modalPanelLg}>
        <div className={modalHeader}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {title || (initial ? "Edit Inquiry" : "New Inquiry")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reception / counselor inquiry form
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className={modalBody + " space-y-6"}>
            {duplicates.length > 0 && !forceContinue && !initial ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">
                      An inquiry with this mobile number already exists.
                    </p>
                    <ul className="mt-2 text-xs space-y-1">
                      {duplicates.map((d) => (
                        <li key={d.id}>
                          {d.inquiryId} — {d.fullName} ({d.status})
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        className={btnSecondary + " text-xs py-1.5"}
                        onClick={() => {
                          setDuplicates([]);
                          onClose();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={btnPrimary + " text-xs py-1.5"}
                        onClick={() => setForceContinue(true)}
                      >
                        Continue anyway
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Personal Details</h3>
              <div className={formGrid}>
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input
                    required
                    className={inputClass}
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Mobile Number *</label>
                  <input
                    required
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => {
                      setForceContinue(false);
                      setDuplicates([]);
                      set("phone", e.target.value);
                    }}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div>
                  <label className={labelClass}>Age</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    className={inputClass}
                    value={form.age ?? ""}
                    onChange={(e) =>
                      set("age", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Gender</label>
                  <select
                    className={inputClass}
                    value={form.gender || ""}
                    onChange={(e) => set("gender", e.target.value as InquiryGender | "")}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className={formGridFull}>
                  <label className={labelClass}>Email ID (optional)</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email || ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Education & Profession</h3>
              <div className={formGrid}>
                <div>
                  <label className={labelClass}>Education Status</label>
                  <select
                    className={inputClass}
                    value={form.educationStatus || ""}
                    onChange={(e) => set("educationStatus", e.target.value)}
                  >
                    <option value="">Select</option>
                    {EDUCATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Occupation</label>
                  <select
                    className={inputClass}
                    value={form.occupation || ""}
                    onChange={(e) => set("occupation", e.target.value)}
                  >
                    <option value="">Select</option>
                    {OCCUPATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Course & Source</h3>
              <div className={formGrid}>
                <div>
                  <label className={labelClass}>Interested Course</label>
                  <select
                    className={inputClass}
                    value={form.courseId || ""}
                    onChange={(e) => handleCourseChange(e.target.value)}
                  >
                    <option value="">Select course</option>
                    {courses
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <option key={c.id} value={c.courseId || c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Inquiry Source</label>
                  <select
                    className={inputClass}
                    value={form.source || "Offline"}
                    onChange={(e) => set("source", e.target.value)}
                  >
                    {INQUIRY_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={form.status || "New"}
                    onChange={(e) =>
                      set("status", e.target.value as InquiryFormInput["status"])
                    }
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
                    value={form.priority || "Medium"}
                    onChange={(e) =>
                      set("priority", e.target.value as InquiryFormInput["priority"])
                    }
                  >
                    {INQUIRY_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Next Follow-up Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.nextFollowUpDate || ""}
                    onChange={(e) => set("nextFollowUpDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Next Action</label>
                  <select
                    className={inputClass}
                    value={form.nextAction || ""}
                    onChange={(e) => set("nextAction", e.target.value)}
                  >
                    <option value="">Select</option>
                    {NEXT_ACTION_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Documents (optional)</h3>
              <div className={formGrid}>
                <InquiryDocUpload
                  label="Student Photo"
                  value={form.studentPhotoUrl || ""}
                  onChange={(url) => set("studentPhotoUrl", url)}
                />
                <InquiryDocUpload
                  label="Aadhaar Card"
                  value={form.aadhaarUrl || ""}
                  onChange={(url) => set("aadhaarUrl", url)}
                />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Notes</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    placeholder="Weekend batch needed, fees next month, parents discussion..."
                    value={form.description || ""}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Internal Notes (private)</label>
                  <textarea
                    className={textareaClass}
                    rows={2}
                    placeholder="Counselor-only notes..."
                    value={form.internalNotes || ""}
                    onChange={(e) => set("internalNotes", e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className={modalFooter}>
            <button type="button" onClick={onClose} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Saving..." : initial ? "Update Inquiry" : "Save Inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
