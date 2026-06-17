"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, X } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { adminApi } from "@/lib/adminApi";
import { subscribeToCourses } from "@/lib/courseService";
import type { Course } from "@/types/course";
import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter, pageHeader, pageHeaderActions, pageTitle, pageSubtitle } from "@/lib/theme";
import CredentialsModal from "@/components/admin/CredentialsModal";
import { generateSecurePassword } from "@/lib/passwordUtils";
import { RefreshCw } from "lucide-react";

export default function AdmissionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [admissions, setAdmissions] = useState<Record<string, unknown>[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextDueDate, setNextDueDate] = useState("");
  const [autoPassword, setAutoPassword] = useState(true);
  const [studentPassword, setStudentPassword] = useState("");
  const [credentials, setCredentials] = useState<{ title: string; rows: { label: string; value: string }[] } | null>(null);

  const fetchAdmissions = async () => {
    try {
      const q = query(collection(db, "admissions"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAdmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(collection(db, "admissions"));
      setAdmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmissions();
    return subscribeToCourses(setCourses);
  }, []);

  useEffect(() => {
    if (admissionDate) {
      const d = new Date(admissionDate);
      d.setMonth(d.getMonth() + 1);
      setNextDueDate(d.toISOString().split("T")[0]);
    }
  }, [admissionDate]);

  const selectedCourse = courses.find((c) => (c.courseId || c.id) === selectedCourseId);

  const handleCreateAdmission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedCourse) {
      showToast("error", "Please select a course.");
      return;
    }
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await adminApi.createAdmission({
        fullName: formData.get("fullName") as string,
        parentName: formData.get("parentName") as string,
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
        password: autoPassword ? undefined : studentPassword || undefined,
        courseId: selectedCourseId,
        courseTitle: selectedCourse.title,
        batch: formData.get("batch") as string,
        rollNumber: formData.get("rollNumber") as string,
        qualification: formData.get("qualification") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        admissionDate: formData.get("admissionDate") as string,
        courseDuration: formData.get("courseDuration") as string,
        nextDueDate: formData.get("nextDueDate") as string,
        totalCourseFee: Number(formData.get("totalCourseFee")),
        discount: Number(formData.get("discount") || 0),
        admissionFeePaid: Number(formData.get("admissionFeePaid") || 0),
        paymentMethod: formData.get("paymentMethod") as string,
        notes: formData.get("notes") as string,
      });
      if (result.isNewStudent && result.temporaryPassword) {
        setCredentials({
          title: "Student Account Created",
          rows: [
            { label: "Student ID", value: result.studentId },
            { label: "Email", value: result.email },
            { label: "Temporary Password", value: result.temporaryPassword },
          ],
        });
      }
      showToast("success", result.message || "Admission processed successfully.");
      setShowModal(false);
      setStudentPassword("");
      fetchAdmissions();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Admission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this admission log? (Student account will not be deleted.)")) return;
    await deleteDoc(doc(db, "admissions", id));
    fetchAdmissions();
  };

  const filtered = admissions.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      String(a.fullName || "").toLowerCase().includes(q) ||
      String(a.studentId || "").toLowerCase().includes(q) ||
      String(a.course || "").toLowerCase().includes(q)
    );
  });

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Admission Process</h1>
          <p className={pageSubtitle}>
            Single flow: creates student account, admission record, login credentials, batch & course enrollment.
          </p>
        </div>
        <div className={pageHeaderActions}>
          <button type="button" onClick={() => setShowModal(true)} className={btnPrimaryBlock}>
            <Plus size={18} /> New Admission
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className={inputClass + " pl-10"} placeholder="Search admissions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Student ID</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Applicant</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No admissions yet.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={String(a.id)} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-4 font-mono text-sm text-[#6C3CE9]">{String(a.studentId)}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{String(a.fullName)}</p>
                    <p className="text-xs text-slate-400">{String(a.email)}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{String(a.course)}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{String(a.batch || "—")}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{String(a.admissionDate)}</td>
                  <td className="px-5 py-4 text-right">
                    {user?.role === "Super Admin" && (
                      <button onClick={() => handleDelete(String(a.id))} className="p-2 text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Admission</h2>
                <p className="text-xs text-slate-500">Creates account + enrollment if new; adds course if existing student.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateAdmission} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-h-0">
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Full Name *</label><input name="fullName" required className={inputClass} /></div>
                  <div><label className={labelClass}>Parent Name</label><input name="parentName" className={inputClass} /></div>
                  <div><label className={labelClass}>Email *</label><input name="email" type="email" required className={inputClass} /></div>
                  <div><label className={labelClass}>Mobile *</label><input name="phone" required className={inputClass} /></div>
                  <div className="md:col-span-2 border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-800">Login Password (new students)</p>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" checked={autoPassword} onChange={() => setAutoPassword(true)} className="accent-[#6C3CE9]" />
                      Auto-generate secure password
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" checked={!autoPassword} onChange={() => setAutoPassword(false)} className="accent-[#6C3CE9]" />
                      Set custom password
                    </label>
                    {!autoPassword && (
                      <input
                        type="text"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        className={inputClass + " font-mono"}
                        placeholder="Min 6 characters"
                      />
                    )}
                    {autoPassword && (
                      <button
                        type="button"
                        onClick={() => setStudentPassword(generateSecurePassword(10))}
                        className="text-sm text-[#6C3CE9] flex items-center gap-1"
                      >
                        <RefreshCw size={14} /> Preview sample password (actual password generated on submit)
                      </button>
                    )}
                  </div>
                  <div><label className={labelClass}>Qualification</label><input name="qualification" className={inputClass} /></div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Course & Batch</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Course *</label>
                    <select className={inputClass} required value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                      <option value="">Select course</option>
                      {courses.filter((c) => c.status === "active").map((c) => (
                        <option key={c.id} value={c.courseId || c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div><label className={labelClass}>Batch</label><input name="batch" className={inputClass} placeholder="e.g. Batch A - Morning" /></div>
                  <div><label className={labelClass}>Roll Number</label><input name="rollNumber" className={inputClass} /></div>
                  <div><label className={labelClass}>Course Duration</label><input name="courseDuration" className={inputClass} placeholder="6 Months" /></div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Address & Fees</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className={labelClass}>Address</label><input name="address" className={inputClass} /></div>
                  <div><label className={labelClass}>City</label><input name="city" className={inputClass} /></div>
                  <div><label className={labelClass}>State</label><input name="state" className={inputClass} /></div>
                  <div><label className={labelClass}>Admission Date</label><input name="admissionDate" type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Next Due Date</label><input name="nextDueDate" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Total Fee (₹)</label><input name="totalCourseFee" type="number" min="0" className={inputClass} /></div>
                  <div><label className={labelClass}>Discount (₹)</label><input name="discount" type="number" min="0" defaultValue="0" className={inputClass} /></div>
                  <div><label className={labelClass}>Fee Paid (₹)</label><input name="admissionFeePaid" type="number" min="0" defaultValue="0" className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Payment Method</label>
                    <select name="paymentMethod" className={inputClass}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="md:col-span-2"><label className={labelClass}>Notes</label><input name="notes" className={inputClass} /></div>
                </div>
              </section>
              <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
                <button type="button" onClick={() => setShowModal(false)} className={btnSecondaryBlock}>Cancel</button>
                <button type="submit" disabled={submitting} className={btnPrimaryBlock}>{submitting ? "Processing..." : "Confirm Admission"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CredentialsModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title || ""}
        subtitle="Share with the student securely."
        rows={credentials?.rows || []}
        notice="Student should change password on first login in the mobile app."
      />
    </PageTransition>
  );
}
