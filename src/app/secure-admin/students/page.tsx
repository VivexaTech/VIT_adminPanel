"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import StudentFormModal, { StudentFormData } from "@/components/admin/students/StudentFormModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import Link from "next/link";
import { Search, UserPlus, Edit2, Trash2, KeyRound, Ban, CheckCircle } from "lucide-react";
import { collection, doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { createApprovalRequest } from "@/lib/approvalService";
import { logAudit } from "@/lib/auditService";
import { subscribeToCourses } from "@/lib/courseService";
import { adminApi } from "@/lib/adminApi";
import type { Course } from "@/types/course";
import { btnPrimary, inputClass } from "@/lib/theme";

type Student = StudentFormData & { id: string; uid?: string; joinDate?: string };

export default function StudentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isSuperAdmin, can } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "students"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
      list.sort((a, b) => (b.joinDate || "").localeCompare(a.joinDate || ""));
      setStudents(list);
      setLoading(false);
    });
    const unsubCourses = subscribeToCourses(setCourses);
    return () => {
      unsub();
      unsubCourses();
    };
  }, []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        s.fullName?.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q) ||
        s.rollNumber?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 12);

  const handleEdit = async (data: StudentFormData) => {
    if (!editStudent) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "students", editStudent.id), {
        fullName: data.fullName.trim(),
        parentName: data.parentName.trim() || null,
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        course: data.course.trim(),
        courseId: data.courseId || null,
        batch: data.batch.trim() || null,
        rollNumber: data.rollNumber.trim() || null,
        status: data.status,
        updatedAt: serverTimestamp(),
      });

      if (data.status === "Inactive" || data.status === "Suspended") {
        await adminApi.setStudentStatus(editStudent.id, data.status, true);
      } else if (data.status === "Active") {
        await adminApi.setStudentStatus(editStudent.id, data.status, false);
      }

      showToast("success", "Student updated.");
      setEditStudent(null);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) {
      showToast("error", "Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await adminApi.resetPassword(resetTarget.id, {
        password: newPassword,
        forcePasswordChange: true,
      });
      showToast("success", "Password reset successfully.");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      if (isSuperAdmin) {
        await adminApi.deleteStudent(deleteTarget.id);
        await logAudit(user, "student_deleted", { resourceId: deleteTarget.id, details: deleteTarget.fullName });
        showToast("success", "Student account deleted.");
      } else {
        await createApprovalRequest(user, {
          actionType: "student_delete",
          targetId: deleteTarget.id,
          targetLabel: deleteTarget.fullName,
          remarks: `Request to delete student ${deleteTarget.fullName}`,
          payload: { studentId: deleteTarget.id },
        });
        showToast("success", "Delete request submitted. Status: Pending Approval.");
      }
      setDeleteTarget(null);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    const newStatus = student.status === "Active" ? "Suspended" : "Active";
    try {
      await updateDoc(doc(db, "students", student.id), { status: newStatus });
      await adminApi.setStudentStatus(student.id, newStatus, newStatus !== "Active");
      showToast("success", `Student ${newStatus === "Active" ? "activated" : "suspended"}.`);
    } catch {
      showToast("error", "Failed to update status.");
    }
  };

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-1">
            View and manage enrolled students. New admissions are created from the Admissions page.
          </p>
        </div>
        <Link href="/secure-admin/admissions" className={btnPrimary}>
          <UserPlus size={18} /> New Admission
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, ID, email, course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputClass + " pl-10"}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + " sm:w-44"}>
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ID / Roll</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Contact</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading students...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No students found.</td></tr>
              ) : (
                paginated.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{s.fullName}</p>
                      {s.parentName && <p className="text-xs text-slate-400">Parent: {s.parentName}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-mono text-sm text-[#6C3CE9]">{s.studentId || s.id}</p>
                      {s.rollNumber && <p className="text-xs text-slate-400">Roll: {s.rollNumber}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{s.course}{s.batch ? ` · ${s.batch}` : ""}</td>
                    <td className="px-5 py-4 text-sm">
                      <p className="text-slate-700">{s.phone}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                        s.status === "Suspended" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      }`}>{s.status || "Active"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button title="Edit" onClick={() => setEditStudent(s)} className="p-2 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-[#6C3CE9]"><Edit2 size={16} /></button>
                        <button title="Reset Password" onClick={() => setResetTarget(s)} className="p-2 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-[#6C3CE9]"><KeyRound size={16} /></button>
                        <button title="Toggle Status" onClick={() => toggleStatus(s)} className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600">
                          {s.status === "Active" ? <Ban size={16} /> : <CheckCircle size={16} />}
                        </button>
                        {can("manage_students") && (
                          <button title={isSuperAdmin ? "Delete" : "Request Delete"} onClick={() => setDeleteTarget(s)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={pageSize} />
      </div>

      <StudentFormModal
        open={!!editStudent}
        mode="edit"
        initial={editStudent ?? undefined}
        courses={courses}
        saving={saving}
        onClose={() => !saving && setEditStudent(null)}
        onSubmit={handleEdit}
      />

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200">
            <h3 className="font-semibold text-slate-900">Reset Password</h3>
            <p className="text-sm text-slate-500 mt-1">Set a new password for {resetTarget.fullName}</p>
            <input type="password" className={inputClass + " mt-4"} placeholder="New password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
              <button type="button" onClick={() => { setResetTarget(null); setNewPassword(""); }} className="w-full sm:w-auto px-4 py-2.5 text-slate-500 rounded-xl border border-slate-200 sm:border-0">Cancel</button>
              <button type="button" onClick={handleResetPassword} disabled={saving} className={btnPrimary + " w-full sm:w-auto"}>Reset</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student Account"
        message={`Permanently delete ${deleteTarget?.fullName}?\n\nThis removes their Firebase Auth account, profile, and fee records.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  );
}
