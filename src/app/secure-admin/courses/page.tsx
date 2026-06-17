"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import CourseFormModal from "@/components/admin/courses/CourseFormModal";
import CourseViewModal from "@/components/admin/courses/CourseViewModal";
import CsvImportModal from "@/components/admin/courses/CsvImportModal";
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Filter,
  Download,
  Upload,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createApprovalRequest } from "@/lib/approvalService";
import { isSuperAdmin } from "@/lib/rbac";
import { coursesToCsv, downloadCsv } from "@/lib/courseCsv";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, pageHeader, pageHeaderActions, toolbar } from "@/lib/theme";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import type { Course, CourseFormValues } from "@/types/course";
import { COURSE_CATEGORIES } from "@/types/course";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  toggleCourseStatus,
  subscribeToCourses,
  formatCourseDate,
} from "@/lib/courseService";

type StatusFilter = "all" | "active" | "inactive";
type SortOrder = "latest" | "oldest";

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewCourse, setViewCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToCourses(
      (data) => {
        setCourses(data);
        setLoading(false);
        setFetchError(null);
      },
      (err) => {
        console.error(err);
        setFetchError("Failed to load courses. Check Firestore rules and indexes.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const stats = useMemo(
    () => ({
      total: courses.length,
      active: courses.filter((c) => c.status === "active").length,
      inactive: courses.filter((c) => c.status === "inactive").length,
      featured: courses.filter((c) => c.featured).length,
    }),
    [courses]
  );

  const filteredCourses = useMemo(() => {
    let list = [...courses];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.courseId || c.id).toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.instructorName?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      list = list.filter((c) => c.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return sortOrder === "latest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [courses, searchTerm, categoryFilter, statusFilter, sortOrder]);

  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filteredCourses, 10);

  const handleExport = () => {
    const csv = coursesToCsv(filteredCourses);
    const suffix = filteredCourses.length !== courses.length ? "filtered" : "all";
    downloadCsv(`vivexa-courses-${suffix}-${Date.now()}.csv`, csv);
    showToast("success", `Exported ${filteredCourses.length} courses.`);
  };

  const openCreate = () => {
    setFormMode("create");
    setEditingCourse(null);
    setShowForm(true);
  };

  const openEdit = (course: Course) => {
    setViewCourse(null);
    setFormMode("edit");
    setEditingCourse(course);
    setShowForm(true);
  };

  const handleSave = async (values: CourseFormValues) => {
    setSaving(true);
    try {
      if (formMode === "create") {
        await createCourse(values);
        showToast("success", "Course created successfully!");
      } else if (editingCourse) {
        await updateCourse(editingCourse.courseId || editingCourse.id, values);
        showToast("success", "Course updated successfully!");
      }
      setShowForm(false);
      setEditingCourse(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: Course) => {
    const confirmed = window.confirm(
      `Delete "${course.title}"?\n\nThis will permanently remove the course from Firebase. Students will no longer see it in the app.`
    );
    if (!confirmed) return;
    try {
      const courseId = course.courseId || course.id;
      if (!isSuperAdmin(user?.role) && user) {
        await createApprovalRequest(user, {
          actionType: "course_delete",
          targetId: courseId,
          targetLabel: course.title,
          remarks: `Delete course ${course.title}`,
          payload: { courseId },
        });
        showToast("success", "Course deletion submitted. Status: Pending Approval.");
        return;
      }
      await deleteCourse(courseId);
      showToast("success", "Course deleted.");
    } catch {
      showToast("error", "Failed to delete course.");
    }
  };

  const handleToggleStatus = async (course: Course) => {
    const action = course.status === "active" ? "disable" : "enable";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${course.title}"?`
    );
    if (!confirmed) return;
    try {
      const newStatus = await toggleCourseStatus(course.courseId || course.id, course.status);
      showToast("success", `Course ${newStatus === "active" ? "enabled" : "disabled"}.`);
    } catch {
      showToast("error", "Failed to update course status.");
    }
  };

  if (!user) return null;

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="text-[#6C3CE9] shrink-0" size={26} />
            Course Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create, import, and manage courses. Changes sync in real time to the student app.
          </p>
        </div>
        <div className={pageHeaderActions}>
          <button type="button" onClick={() => setShowCsvImport(true)} className={btnSecondaryBlock}>
            <Upload size={16} /> Import CSV
          </button>
          <button type="button" onClick={handleExport} className={btnSecondaryBlock}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" onClick={openCreate} className={btnPrimaryBlock}>
            <Plus size={18} /> Add Course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatPill label="Total Courses" value={stats.total} accent="cyan" />
        <StatPill label="Active" value={stats.active} accent="emerald" />
        <StatPill label="Inactive" value={stats.inactive} accent="gray" />
        <StatPill label="Featured" value={stats.featured} accent="amber" />
      </div>

      <div className={toolbar}>
        <div className="flex flex-col lg:flex-row gap-3 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by course name, category, or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClass + " pl-10"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              icon={<Filter size={16} />}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "All Categories" },
                ...COURSE_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <FilterSelect
              value={sortOrder}
              onChange={(v) => setSortOrder(v as SortOrder)}
              options={[
                { value: "latest", label: "Latest First" },
                { value: "oldest", label: "Oldest First" },
              ]}
            />
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      <div className="lg:hidden space-y-3 mb-4">
        {!loading &&
          paginated.map((course) => (
            <div key={course.id} className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex gap-3">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={course.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 line-clamp-2">{course.title}</p>
                  <p className="text-xs text-slate-400 font-mono">{course.courseId || course.id}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{course.category}</span>
                <span className={`px-2 py-1 rounded-full ${course.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {course.status === "active" ? "Active" : "Inactive"}
                </span>
                <span className="px-2 py-1 rounded-full bg-violet-50 text-[#6C3CE9] font-medium">₹{course.price}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 pt-1">
                <ActionBtn title="View" onClick={() => setViewCourse(course)} icon={<Eye size={17} />} />
                <ActionBtn title="Edit" onClick={() => openEdit(course)} icon={<Edit2 size={17} />} />
                <ActionBtn
                  title={course.status === "active" ? "Disable" : "Enable"}
                  onClick={() => handleToggleStatus(course)}
                  icon={course.status === "active" ? <ToggleRight size={17} className="text-emerald-400" /> : <ToggleLeft size={17} />}
                />
                <ActionBtn title="Delete" onClick={() => handleDelete(course)} icon={<Trash2 size={17} />} danger />
              </div>
            </div>
          ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden hidden lg:block">
        <div className="admin-table-scroll">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Course ID</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Price</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-3">Loading courses...</p>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    {courses.length === 0
                      ? "No courses yet. Click \"Add Course\" to create your first course."
                      : "No courses match your filters."}
                  </td>
                </tr>
              ) : (
                paginated.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4 font-mono text-sm text-[#6C3CE9]">{course.courseId || course.id}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={course.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 line-clamp-1">{course.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {course.level} • {course.instructorName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-600 text-sm">{course.category}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="text-slate-900 font-medium">₹{course.price}</div>
                      {course.originalPrice && (
                        <div className="text-xs text-slate-400 line-through">
                          ₹{course.originalPrice}
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          course.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {course.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-500 text-sm">
                      {formatCourseDate(course.createdAt)}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <ActionBtn
                          title="View"
                          onClick={() => setViewCourse(course)}
                          icon={<Eye size={17} />}
                        />
                        <ActionBtn
                          title="Edit"
                          onClick={() => openEdit(course)}
                          icon={<Edit2 size={17} />}
                        />
                        <ActionBtn
                          title={course.status === "active" ? "Disable" : "Enable"}
                          onClick={() => handleToggleStatus(course)}
                          icon={
                            course.status === "active" ? (
                              <ToggleRight size={17} className="text-emerald-400" />
                            ) : (
                              <ToggleLeft size={17} className="text-slate-400" />
                            )
                          }
                        />
                        <ActionBtn
                          title="Delete"
                          onClick={() => handleDelete(course)}
                          icon={<Trash2 size={17} />}
                          danger
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredCourses.length} pageSize={pageSize} />
      </div>

      <CsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onComplete={(r) => {
          showToast(
            "success",
            `Import done: ${r.inserted} added, ${r.updated} updated, ${r.skipped + r.errors.length} skipped.`
          );
        }}
      />

      <CourseFormModal
        open={showForm}
        mode={formMode}
        course={editingCourse}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setShowForm(false);
            setEditingCourse(null);
          }
        }}
        onSubmit={handleSave}
      />

      <CourseViewModal
        course={viewCourse}
        onClose={() => setViewCourse(null)}
        onEdit={(c) => openEdit(c)}
      />
    </PageTransition>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "cyan" | "emerald" | "gray" | "amber";
}) {
  const colors = {
    cyan: "from-violet-500/10 to-violet-500/5 border-violet-200 text-violet-600",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-600",
    gray: "from-slate-500/10 to-slate-500/5 border-slate-200 text-slate-600",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-600",
  };
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 bg-gradient-to-br ${colors[accent]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-8 appearance-none w-full sm:w-auto ${icon ? "pl-9" : ""}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActionBtn({
  title,
  onClick,
  icon,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        danger
          ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
          : "text-slate-400 hover:text-[#6C3CE9] hover:bg-violet-50"
      }`}
    >
      {icon}
    </button>
  );
}
