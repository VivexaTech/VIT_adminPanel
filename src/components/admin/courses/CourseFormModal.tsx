"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import ImageUploadField from "./ImageUploadField";
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  EMPTY_COURSE_FORM,
  type Course,
  type CourseFormValues,
} from "@/types/course";
import { courseToFormValues } from "@/lib/courseService";
import {
  inputClass,
  labelClass,
  modalOverlay,
  modalPanelLg,
  modalHeader,
  modalBody,
  modalFooter,
  btnPrimaryBlock,
  btnSecondaryBlock,
  formGrid,
} from "@/lib/theme";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  course?: Course | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: CourseFormValues) => Promise<void>;
};

function validate(values: CourseFormValues, mode: "create" | "edit"): string | null {
  if (values.courseId.trim() && !/^[A-Za-z0-9_-]+$/.test(values.courseId.trim())) {
    return "Course ID must be alphanumeric (dashes/underscores allowed).";
  }
  if (!values.title.trim() || values.title.trim().length < 3) {
    return "Course title must be at least 3 characters.";
  }
  if (!values.description.trim() || values.description.trim().length < 20) {
    return "Description must be at least 20 characters.";
  }
  if (!values.category.trim()) return "Please select a category.";
  if (!values.imageUrl.trim()) return "Course thumbnail is required.";
  if (!values.duration.trim()) return "Course duration is required.";
  if (!values.price.trim() || isNaN(Number(values.price))) {
    return "Enter a valid course price.";
  }
  if (values.discountPrice.trim() && isNaN(Number(values.discountPrice))) {
    return "Enter a valid discount price.";
  }
  if (
    values.discountPrice.trim() &&
    Number(values.discountPrice) >= Number(values.price)
  ) {
    return "Discount price must be lower than the course price.";
  }
  if (!values.instructorName.trim()) return "Instructor name is required.";
  if (!values.curriculum.some((c) => c.trim())) {
    return "Add at least one syllabus item.";
  }
  return null;
}

export default function CourseFormModal({
  open,
  mode,
  course,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<CourseFormValues>(EMPTY_COURSE_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(course ? courseToFormValues(course) : EMPTY_COURSE_FORM);
  }, [open, course]);

  if (!open) return null;

  const updateList = (
    key: "features" | "curriculum",
    index: number,
    text: string
  ) => {
    setValues((prev) => {
      const list = [...prev[key]];
      list[index] = text;
      return { ...prev, [key]: list };
    });
  };

  const addListItem = (key: "features" | "curriculum") => {
    setValues((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  };

  const removeListItem = (key: "features" | "curriculum", index: number) => {
    setValues((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(values, mode);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course.");
    }
  };

  return (
    <div className={modalOverlay} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className={modalPanelLg} onClick={(e) => e.stopPropagation()}>
        <div className={modalHeader}>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {mode === "create" ? "Add New Course" : "Edit Course"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {mode === "create"
                ? "Create a course that will appear in the student app."
                : `Editing: ${course?.title}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={`${modalBody} space-y-6`}>
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <section>
            <h3 className="text-[#6C3CE9] font-semibold mb-4 pb-2 border-b border-slate-200">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Course ID {mode === "create" ? "(auto if empty)" : ""}</label>
                <input
                  className={inputClass}
                  value={values.courseId}
                  disabled={mode === "edit"}
                  onChange={(e) => setValues({ ...values, courseId: e.target.value.toUpperCase() })}
                  placeholder="VXC-001"
                />
              </div>
              <div>
                <label className={labelClass}>Course Level *</label>
                <select
                  className={inputClass}
                  value={values.level}
                  onChange={(e) =>
                    setValues({ ...values, level: e.target.value as CourseFormValues["level"] })
                  }
                >
                  {COURSE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Course Title *</label>
                <input
                  className={inputClass}
                  value={values.title}
                  onChange={(e) => setValues({ ...values, title: e.target.value })}
                  placeholder="e.g. Full Stack Web Development"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Course Subtitle</label>
                <input
                  className={inputClass}
                  value={values.subtitle}
                  onChange={(e) => setValues({ ...values, subtitle: e.target.value })}
                  placeholder="Optional short tagline"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Course Description *</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={values.description}
                  onChange={(e) => setValues({ ...values, description: e.target.value })}
                  placeholder="Describe what students will learn..."
                />
              </div>
              <div>
                <label className={labelClass}>Category *</label>
                <select
                  className={inputClass}
                  value={values.category}
                  onChange={(e) => setValues({ ...values, category: e.target.value })}
                >
                  <option value="">Select category</option>
                  {COURSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Duration *</label>
                <input
                  className={inputClass}
                  value={values.duration}
                  onChange={(e) => setValues({ ...values, duration: e.target.value })}
                  placeholder="e.g. 6 Months"
                />
              </div>
              <div>
                <label className={labelClass}>Instructor / Trainer *</label>
                <input
                  className={inputClass}
                  value={values.instructorName}
                  onChange={(e) => setValues({ ...values, instructorName: e.target.value })}
                  placeholder="Instructor full name"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[#6C3CE9] font-semibold mb-4 pb-2 border-b border-slate-200">
              Media
            </h3>
            <div className="space-y-5">
              <ImageUploadField
                label="Course Thumbnail"
                value={values.imageUrl}
                onChange={(url) => setValues({ ...values, imageUrl: url })}
                required
                hint="Recommended: 800×450px. Shown on course cards in the app."
              />
              <ImageUploadField
                label="Course Banner"
                value={values.bannerUrl}
                onChange={(url) => setValues({ ...values, bannerUrl: url })}
                hint="Optional wide banner for course detail page."
              />
            </div>
          </section>

          <section>
            <h3 className="text-[#6C3CE9] font-semibold mb-4 pb-2 border-b border-slate-200">
              Pricing & Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Course Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={values.price}
                  onChange={(e) => setValues({ ...values, price: e.target.value })}
                  placeholder="15000"
                />
              </div>
              <div>
                <label className={labelClass}>Discount Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={values.discountPrice}
                  onChange={(e) => setValues({ ...values, discountPrice: e.target.value })}
                  placeholder="Optional sale price"
                />
              </div>
              <div>
                <label className={labelClass}>Live Classes</label>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={values.liveClasses}
                  onChange={(e) => setValues({ ...values, liveClasses: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Status *</label>
                <select
                  className={inputClass}
                  value={values.status}
                  onChange={(e) =>
                    setValues({ ...values, status: e.target.value as CourseFormValues["status"] })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center gap-6 md:col-span-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.certificate}
                    onChange={(e) => setValues({ ...values, certificate: e.target.checked })}
                    className="rounded border-cyan-500/30"
                  />
                  Certificate Available
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.featured}
                    onChange={(e) => setValues({ ...values, featured: e.target.checked })}
                    className="rounded border-cyan-500/30"
                  />
                  Featured on Home
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-cyan-400 font-semibold">Course Features</h3>
              <button
                type="button"
                onClick={() => addListItem("features")}
                className="text-cyan-400 text-sm flex items-center gap-1 hover:text-cyan-300"
              >
                <Plus size={16} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {values.features.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={item}
                    onChange={(e) => updateList("features", index, e.target.value)}
                    placeholder="e.g. Live doubt sessions"
                  />
                  {values.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeListItem("features", index)}
                      className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-cyan-400 font-semibold">Course Syllabus *</h3>
              <button
                type="button"
                onClick={() => addListItem("curriculum")}
                className="text-cyan-400 text-sm flex items-center gap-1 hover:text-cyan-300"
              >
                <Plus size={16} /> Add Module
              </button>
            </div>
            <div className="space-y-2">
              {values.curriculum.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-gray-500 text-sm pt-2.5 w-6">{index + 1}.</span>
                  <input
                    className={inputClass}
                    value={item}
                    onChange={(e) => updateList("curriculum", index, e.target.value)}
                    placeholder="Module / lesson title"
                  />
                  {values.curriculum.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeListItem("curriculum", index)}
                      className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </form>

        <div className={modalFooter}>
          <button type="button" onClick={onClose} disabled={saving} className={btnSecondaryBlock}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className={btnPrimaryBlock}
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {mode === "create" ? "Create Course" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
