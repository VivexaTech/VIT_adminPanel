"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import AdminModal from "@/components/ui/AdminModal";
import { inputClass, labelClass, btnPrimaryBlock, btnSecondaryBlock, formGrid } from "@/lib/theme";
import type { Course } from "@/types/course";

export type StudentFormData = {
  studentId: string;
  fullName: string;
  parentName: string;
  email: string;
  phone: string;
  password: string;
  course: string;
  courseId: string;
  batch: string;
  rollNumber: string;
  status: string;
  enrolledCourses: string[];
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<StudentFormData> & { id?: string };
  courses: Course[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: StudentFormData) => Promise<void>;
};

const EMPTY: StudentFormData = {
  studentId: "",
  fullName: "",
  parentName: "",
  email: "",
  phone: "",
  password: "",
  course: "",
  courseId: "",
  batch: "",
  rollNumber: "",
  status: "Active",
  enrolledCourses: [],
};

export default function StudentFormModal({
  open,
  mode,
  initial,
  courses,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<StudentFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && initial) {
      setForm({
        ...EMPTY,
        studentId: initial.studentId || "",
        fullName: initial.fullName || "",
        parentName: initial.parentName || "",
        email: initial.email || "",
        phone: initial.phone || "",
        password: "",
        course: initial.course || "",
        courseId: initial.courseId || "",
        batch: initial.batch || "",
        rollNumber: initial.rollNumber || "",
        status: initial.status || "Active",
        enrolledCourses: initial.enrolledCourses || (initial.course ? [initial.course] : []),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, initial]);

  const handleCourseChange = (title: string) => {
    const match = courses.find((c) => c.title === title);
    setForm((f) => ({
      ...f,
      course: title,
      courseId: match?.courseId || match?.id || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Name, email, and phone are required.");
      return;
    }
    if (mode === "create" && (!form.password || form.password.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!form.course.trim()) {
      setError("Course enrollment is required.");
      return;
    }
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Student Account" : "Edit Student"}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={btnSecondaryBlock} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="student-form" className={btnPrimaryBlock} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {mode === "create" ? "Create Account" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className={formGrid}>
          <div>
            <label className={labelClass}>Student ID {mode === "create" && "(auto if empty)"}</label>
            <input
              className={inputClass}
              value={form.studentId}
              disabled={mode === "edit"}
              onChange={(e) => setForm({ ...form, studentId: e.target.value.toUpperCase() })}
              placeholder="ST001"
            />
          </div>
          <div>
            <label className={labelClass}>Roll Number</label>
            <input
              className={inputClass}
              value={form.rollNumber}
              onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Student Name *</label>
            <input
              className={inputClass}
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Parent Name</label>
            <input
              className={inputClass}
              value={form.parentName}
              onChange={(e) => setForm({ ...form, parentName: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              className={inputClass}
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Mobile *</label>
            <input
              className={inputClass}
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          {mode === "create" && (
            <div className="sm:col-span-2">
              <label className={labelClass}>Password *</label>
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Course Enrollment *</label>
            <select
              className={inputClass}
              required
              value={form.course}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              <option value="">Select course</option>
              {courses
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.title}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Batch</label>
            <input
              className={inputClass}
              value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value })}
              placeholder="e.g. Batch A - 2026"
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>
      </form>
    </AdminModal>
  );
}
