"use client";

import { X, BadgeCheck, Star } from "lucide-react";
import type { Course } from "@/types/course";
import { formatCourseDate } from "@/lib/courseService";
import { btnPrimaryBlock, btnSecondaryBlock, modalFooter } from "@/lib/theme";

type Props = {
  course: Course | null;
  onClose: () => void;
  onEdit: (course: Course) => void;
};

export default function CourseViewModal({ course, onClose, onEdit }: Props) {
  if (!course) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full sm:max-w-3xl max-h-[92dvh] rounded-t-2xl sm:rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-xl">
        <div className="relative h-36 sm:h-44 bg-slate-900 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.bannerUrl || course.imageUrl}
            alt={course.title}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg bg-black/40 text-white hover:bg-black/60"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 sm:bottom-4 sm:left-6 sm:right-6">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full text-xs bg-violet-500/30 text-violet-100 border border-violet-400/30">
                {course.category}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-slate-200">
                {course.level}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  course.status === "active"
                    ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/30"
                    : "bg-slate-500/30 text-slate-200 border border-slate-400/30"
                }`}
              >
                {course.status === "active" ? "Active" : "Inactive"}
              </span>
              {course.featured && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/30 text-amber-100 flex items-center gap-1">
                  <Star size={12} /> Featured
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white line-clamp-2">{course.title}</h2>
            {course.subtitle && (
              <p className="text-slate-200 text-sm mt-1 line-clamp-2">{course.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <InfoCard label="Price" value={`₹${course.price}`} />
            <InfoCard label="MRP" value={course.originalPrice ? `₹${course.originalPrice}` : "—"} />
            <InfoCard label="Duration" value={course.duration} />
            <InfoCard label="Live Classes" value={String(course.liveClasses ?? 0)} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Description</h3>
            <p className="text-slate-700 text-sm leading-relaxed">{course.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Instructor</span>
              <p className="text-slate-900 font-medium">{course.instructorName}</p>
            </div>
            <div>
              <span className="text-slate-500">Certificate</span>
              <p className="text-slate-900 font-medium flex items-center gap-1">
                {course.certificate ? (
                  <>
                    <BadgeCheck size={16} className="text-emerald-600" /> Yes
                  </>
                ) : (
                  "No"
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Created</span>
              <p className="text-slate-900 font-medium">{formatCourseDate(course.createdAt)}</p>
            </div>
            <div>
              <span className="text-slate-500">Modules</span>
              <p className="text-slate-900 font-medium">{course.curriculum?.length ?? 0}</p>
            </div>
          </div>

          {course.features?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2">Features</h3>
              <ul className="space-y-1">
                {course.features.map((f, i) => (
                  <li key={i} className="text-slate-700 text-sm flex items-start gap-2">
                    <span className="text-[#6C3CE9] mt-1">•</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {course.curriculum?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2">Syllabus</h3>
              <ol className="space-y-1 list-decimal list-inside">
                {course.curriculum.map((item, i) => (
                  <li key={i} className="text-slate-700 text-sm">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className={modalFooter}>
          <button type="button" onClick={onClose} className={btnSecondaryBlock}>
            Close
          </button>
          <button type="button" onClick={() => onEdit(course)} className={btnPrimaryBlock}>
            Edit Course
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-900 font-semibold mt-1 text-sm sm:text-base">{value}</p>
    </div>
  );
}
