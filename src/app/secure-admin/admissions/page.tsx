"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, X, Pencil } from "lucide-react";
import InquiryDocUpload from "@/components/admin/inquiries/InquiryDocUpload";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { adminApi } from "@/lib/adminApi";
import { subscribeToCourses } from "@/lib/courseService";
import { subscribeToBatches } from "@/lib/batchService";
import { subscribeToDiscounts } from "@/lib/discountService";
import { subscribeToSettings } from "@/lib/settingsService";
import { buildUpiPaymentUrl, computeStackedDiscount } from "@/lib/discountCalc";
import { getInquiryById } from "@/lib/inquiryService";
import type { Course } from "@/types/course";
import type { Batch } from "@/types/erp";
import type { Inquiry } from "@/types/inquiry";
import type { Discount } from "@/types/marketing";
import type { InstituteSettings } from "@/types/erp";
import { btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter, pageHeader, pageHeaderActions, pageTitle, pageSubtitle } from "@/lib/theme";
import CredentialsModal from "@/components/admin/CredentialsModal";
import ReceiptPreviewModal from "@/components/admin/ReceiptPreviewModal";
import { generateSecurePassword } from "@/lib/passwordUtils";
import { RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getPayableFee } from "@/lib/feeValidation";

type ReceiptSuccess = {
  receiptNo: string;
  receiptHtml: string;
  studentId: string;
};

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<PageTransition><p className="text-slate-400 p-6">Loading...</p></PageTransition>}>
      <AdmissionsPageInner />
    </Suspense>
  );
}

function AdmissionsPageInner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromInquiry = searchParams.get("fromInquiry");

  const [admissions, setAdmissions] = useState<Record<string, unknown>[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseBatchesMap, setCourseBatchesMap] = useState<Record<string, string>>({});
  const [courseDisplayName, setCourseDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextDueDate, setNextDueDate] = useState("");
  const [autoPassword, setAutoPassword] = useState(true);
  const [studentPassword, setStudentPassword] = useState("");
  const [credentials, setCredentials] = useState<{ title: string; rows: { label: string; value: string }[] } | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState<ReceiptSuccess | null>(null);
  const [inquiryPrefill, setInquiryPrefill] = useState<Inquiry | null>(null);
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [totalCourseFee, setTotalCourseFee] = useState(0);
  const [feePaid, setFeePaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [settings, setSettings] = useState<InstituteSettings | null>(null);
  const [editingAdmission, setEditingAdmission] = useState<Record<string, unknown> | null>(null);
  const [studentPhotoUrl, setStudentPhotoUrl] = useState("");
  const [aadhaarUrl, setAadhaarUrl] = useState("");

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
    const unsubCourses = subscribeToCourses(setCourses);
    const unsubBatches = subscribeToBatches(setBatches);
    const unsubDiscounts = subscribeToDiscounts(
      setDiscounts,
      (err) => {
        console.error("Discounts load failed:", err);
        setDiscounts([]);
      }
    );
    const unsubSettings = subscribeToSettings(setSettings);
    return () => {
      unsubCourses();
      unsubBatches();
      unsubDiscounts();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (!fromInquiry) return;
    let cancelled = false;
    (async () => {
      try {
        const inq = await getInquiryById(fromInquiry);
        if (cancelled || !inq) {
          if (!cancelled && fromInquiry) showToast("error", "Inquiry not found.");
          return;
        }
        setInquiryPrefill(inq);
        setLinkedInquiryId(inq.id);
        if (inq.courseId) setSelectedCourseIds([inq.courseId]);
        if (inq.courseTitle) {
          setCourseDisplayName(inq.courseTitle);
          setDisplayNameTouched(true);
        }
        setFormKey((k) => k + 1);
        setShowModal(true);
      } catch {
        showToast("error", "Failed to load inquiry for conversion.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromInquiry, showToast]);

  useEffect(() => {
    if (admissionDate) {
      const d = new Date(admissionDate);
      d.setMonth(d.getMonth() + 1);
      setNextDueDate(d.toISOString().split("T")[0]);
    }
  }, [admissionDate]);

  const selectedCourses = useMemo(
    () =>
      selectedCourseIds
        .map((id) => courses.find((c) => (c.courseId || c.id) === id))
        .filter(Boolean) as Course[],
    [selectedCourseIds, courses]
  );

  useEffect(() => {
    if (displayNameTouched) return;
    const titles = selectedCourses.map((c) => c.title);
    if (titles.length === 0) {
      setCourseDisplayName("");
    } else if (titles.length === 1) {
      setCourseDisplayName(titles[0]);
    } else {
      setCourseDisplayName(titles.join(" with "));
    }
  }, [selectedCourses, displayNameTouched]);

  useEffect(() => {
    const sum = selectedCourses.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
    if (sum > 0) setTotalCourseFee(sum);
  }, [selectedCourses]);

  const activeDiscounts = useMemo(
    () => discounts.filter((d) => d.active),
    [discounts]
  );

  const appliedDiscounts = useMemo(
    () => activeDiscounts.filter((d) => selectedDiscountIds.includes(d.id)),
    [activeDiscounts, selectedDiscountIds]
  );

  const discountResult = useMemo(
    () => computeStackedDiscount(totalCourseFee, appliedDiscounts, manualDiscount),
    [totalCourseFee, appliedDiscounts, manualDiscount]
  );

  const payableFee = getPayableFee(totalCourseFee, discountResult.totalDiscount);

  const upiQrValue = useMemo(() => {
    if (paymentMethod !== "UPI" || feePaid <= 0 || !settings?.upiId) return "";
    return buildUpiPaymentUrl({
      upiId: settings.upiId,
      payeeName: settings.upiPayeeName || settings.instituteName || "Institute",
      amount: feePaid,
      note: `Admission ${courseDisplayName || "fee"}`.slice(0, 40),
    });
  }, [paymentMethod, feePaid, settings, courseDisplayName]);

  const clearInquiryLink = () => {
    setInquiryPrefill(null);
    setLinkedInquiryId(null);
    if (fromInquiry) router.replace("/secure-admin/admissions");
  };

  const resetAdmissionForm = () => {
    setSelectedCourseIds([]);
    setCourseBatchesMap({});
    setCourseDisplayName("");
    setDisplayNameTouched(false);
    setSelectedDiscountIds([]);
    setManualDiscount(0);
    setTotalCourseFee(0);
    setFeePaid(0);
    setPaymentMethod("Cash");
    setStudentPassword("");
    setEditingAdmission(null);
    setStudentPhotoUrl("");
    setAadhaarUrl("");
    setFormKey((k) => k + 1);
  };

  const openEditAdmission = (a: Record<string, unknown>) => {
    setEditingAdmission(a);
    setInquiryPrefill(null);
    setLinkedInquiryId(null);
    setCourseDisplayName(String(a.course || ""));
    setDisplayNameTouched(true);
    if (a.courseId) setSelectedCourseIds([String(a.courseId)]);
    if (a.batchId) {
      setCourseBatchesMap({ [String(a.courseId || "")]: String(a.batchId) });
    }
    setAdmissionDate(String(a.admissionDate || new Date().toISOString().slice(0, 10)));
    setNextDueDate(String(a.nextDueDate || ""));
    setPaymentMethod(String(a.paymentMethod || "Cash"));
    setStudentPhotoUrl(String(a.studentPhotoUrl || ""));
    setAadhaarUrl(String(a.aadhaarUrl || ""));
    setFormKey((k) => k + 1);
    setShowModal(true);
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleDiscount = (id: string) => {
    setSelectedDiscountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateAdmission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Edit existing admission — only genuinely required fields enforced
    if (editingAdmission?.id) {
      const fullName = String(formData.get("fullName") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      if (!fullName || !phone) {
        showToast("error", "Full name and phone are required.");
        return;
      }
      setSubmitting(true);
      try {
        await adminApi.updateAdmission(String(editingAdmission.id), {
          studentId: editingAdmission.studentId,
          fullName,
          parentName: formData.get("parentName") || "",
          email: formData.get("email") || "",
          phone,
          qualification: formData.get("qualification") || "",
          address: formData.get("address") || "",
          city: formData.get("city") || "",
          state: formData.get("state") || "",
          admissionDate: formData.get("admissionDate") || admissionDate,
          courseDuration: formData.get("courseDuration") || "",
          nextDueDate: formData.get("nextDueDate") || nextDueDate,
          course: courseDisplayName.trim() || editingAdmission.course,
          courseId: selectedCourseIds[0] || editingAdmission.courseId,
          batch: formData.get("batch") || editingAdmission.batch || "",
          batchId: courseBatchesMap[selectedCourseIds[0]] || editingAdmission.batchId || "",
          notes: formData.get("notes") || "",
          paymentMethod,
          studentPhotoUrl,
          aadhaarUrl,
        });
        showToast("success", "Admission updated.");
        setShowModal(false);
        resetAdmissionForm();
        clearInquiryLink();
        fetchAdmissions();
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "Failed to update admission.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (selectedCourses.length === 0) {
      showToast("error", "Please select at least one course.");
      return;
    }
    if (!courseDisplayName.trim()) {
      showToast("error", "Please enter a course display name (shown on certificate).");
      return;
    }
    setSubmitting(true);
    const courseItems = selectedCourses.map((c) => {
      const id = c.courseId || c.id;
      const batchId = courseBatchesMap[id] || "";
      const batchDoc = batches.find((b) => (b.batchId || b.id) === batchId);
      return {
        courseId: id,
        courseTitle: c.title,
        batchId: batchId || undefined,
        batch: batchDoc?.name || (formData.get("batch") as string) || undefined,
      };
    });
    const primary = courseItems[0];
    try {
      const result = await adminApi.createAdmission({
        fullName: formData.get("fullName") as string,
        parentName: formData.get("parentName") as string,
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
        password: autoPassword ? undefined : studentPassword || undefined,
        courseId: primary.courseId,
        courseTitle: primary.courseTitle,
        courses: courseItems,
        courseDisplayName: courseDisplayName.trim(),
        batch: primary.batch,
        batchId: primary.batchId,
        qualification: formData.get("qualification") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        admissionDate: formData.get("admissionDate") as string,
        courseDuration: formData.get("courseDuration") as string,
        nextDueDate: formData.get("nextDueDate") as string,
        totalCourseFee,
        discount: discountResult.totalDiscount,
        discountIds: selectedDiscountIds,
        manualDiscount: discountResult.manualAmount,
        discountBreakdown: {
          items: discountResult.breakdown,
          manualAmount: discountResult.manualAmount,
        },
        admissionFeePaid: feePaid,
        paymentMethod,
        notes: formData.get("notes") as string,
        inquiryId: linkedInquiryId || undefined,
        studentPhotoUrl,
        aadhaarUrl,
      });
      if (result.isNewStudent && result.temporaryPassword) {
        setCredentials({
          title: "Student Account Created",
          rows: [
            { label: "Student ID", value: result.studentId },
            { label: "Login Email", value: result.loginEmail || result.email },
            { label: "Personal Email", value: result.personalEmail || result.email },
            { label: "Temporary Password", value: result.temporaryPassword },
          ],
        });
      }
      if (result.receiptNo && result.receiptHtml) {
        setReceiptSuccess({
          receiptNo: result.receiptNo,
          receiptHtml: result.receiptHtml,
          studentId: result.studentId,
        });
      } else if (feePaid > 0) {
        showToast("error", "Admission saved, but receipt was not returned. Try recording payment again from Fees.");
      }
      showToast(
        "success",
        linkedInquiryId
          ? "Admission saved. Inquiry marked as Admission Confirmed."
          : result.message || "Admission processed successfully."
      );
      setShowModal(false);
      resetAdmissionForm();
      clearInquiryLink();
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
          <button
            type="button"
            onClick={() => {
              clearInquiryLink();
              resetAdmissionForm();
              setShowModal(true);
            }}
            className={btnPrimaryBlock}
          >
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
                    <button
                      type="button"
                      onClick={() => openEditAdmission(a)}
                      className="p-2 text-slate-400 hover:text-[#6C3CE9]"
                      title="Edit admission"
                    >
                      <Pencil size={16} />
                    </button>
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
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingAdmission
                    ? "Edit Admission"
                    : inquiryPrefill
                      ? "Convert Inquiry to Admission"
                      : "New Admission"}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingAdmission
                    ? "Update missing or existing admission information. Only name and phone are required."
                    : inquiryPrefill
                      ? `Prefilling from ${inquiryPrefill.inquiryId}. Complete fee & remaining details, then confirm.`
                      : "Creates account + enrollment if new; adds course if existing student."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  clearInquiryLink();
                }}
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form key={formKey} onSubmit={handleCreateAdmission} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-h-0">
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Full Name *</label><input name="fullName" required className={inputClass} defaultValue={String(editingAdmission?.fullName || inquiryPrefill?.fullName || "")} /></div>
                  <div><label className={labelClass}>Parent Name</label><input name="parentName" className={inputClass} defaultValue={String(editingAdmission?.parentName || editingAdmission?.fatherName || "")} /></div>
                  <div><label className={labelClass}>Personal Email {editingAdmission ? "" : "*"}</label><input name="email" type="email" required={!editingAdmission} className={inputClass} placeholder="student@gmail.com" defaultValue={String(editingAdmission?.email || inquiryPrefill?.email || "")} /></div>
                  <div><label className={labelClass}>Mobile *</label><input name="phone" required className={inputClass} defaultValue={String(editingAdmission?.phone || inquiryPrefill?.phone || "")} /></div>
                  {!editingAdmission && (
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
                  )}
                  <div>
                    <label className={labelClass}>Qualification</label>
                    <input
                      name="qualification"
                      className={inputClass}
                      defaultValue={String(editingAdmission?.qualification || inquiryPrefill?.educationStatus || "")}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Documents (optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InquiryDocUpload
                    label="Student Photo"
                    value={studentPhotoUrl}
                    onChange={setStudentPhotoUrl}
                  />
                  <InquiryDocUpload
                    label="Aadhaar Card"
                    value={aadhaarUrl}
                    onChange={setAadhaarUrl}
                  />
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Courses &amp; Certificate Name</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Select one or more courses. Student gets all enrollments in a single admission.
                </p>
                <div className="border border-slate-200 rounded-xl p-3 max-h-44 overflow-y-auto space-y-2 mb-4">
                  {courses.filter((c) => c.status === "active").length === 0 ? (
                    <p className="text-sm text-slate-400">No active courses.</p>
                  ) : (
                    courses
                      .filter((c) => c.status === "active")
                      .map((c) => {
                        const id = c.courseId || c.id;
                        const checked = selectedCourseIds.includes(id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer ${
                              checked ? "bg-violet-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-[#6C3CE9]"
                              checked={checked}
                              onChange={() => toggleCourse(id)}
                            />
                            <span className="flex-1 text-sm text-slate-800">{c.title}</span>
                            {c.price ? (
                              <span className="text-xs text-slate-500">₹{Number(c.price).toLocaleString("en-IN")}</span>
                            ) : null}
                          </label>
                        );
                      })
                  )}
                </div>

                {selectedCourses.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {selectedCourses.map((c) => {
                      const id = c.courseId || c.id;
                      const courseBatches = batches.filter(
                        (b) => b.courseId === id || b.courseId === c.id
                      );
                      return (
                        <div key={id} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                          <p className="text-sm font-medium text-slate-700 md:col-span-2">{c.title} — Batch</p>
                          <select
                            className={inputClass}
                            value={courseBatchesMap[id] || ""}
                            onChange={(e) =>
                              setCourseBatchesMap((m) => ({ ...m, [id]: e.target.value }))
                            }
                          >
                            <option value="">No batch</option>
                            {courseBatches.map((b) => (
                              <option key={b.id} value={b.batchId || b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Course name (certificate / records) *</label>
                    <input
                      className={inputClass}
                      value={courseDisplayName}
                      onChange={(e) => {
                        setDisplayNameTouched(true);
                        setCourseDisplayName(e.target.value);
                      }}
                      placeholder="e.g. Python with React"
                      required
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Auto-suggested from selected courses. Edit freely for the certificate title.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Batch label (optional)</label>
                    <input name="batch" className={inputClass} placeholder="e.g. Morning Combined" />
                  </div>
                  <div>
                    <label className={labelClass}>Course Duration</label>
                    <input name="courseDuration" className={inputClass} placeholder="6 Months" />
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-[#6C3CE9] mb-3">Address &amp; Fees</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className={labelClass}>Address</label><input name="address" className={inputClass} /></div>
                  <div><label className={labelClass}>City</label><input name="city" className={inputClass} /></div>
                  <div><label className={labelClass}>State</label><input name="state" className={inputClass} /></div>
                  <div><label className={labelClass}>Admission Date</label><input name="admissionDate" type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Next Due Date</label><input name="nextDueDate" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Total Fee (₹)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={totalCourseFee || ""}
                      onChange={(e) => setTotalCourseFee(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Apply Discounts (multi-select)</label>
                    <div className="border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2">
                      {activeDiscounts.length === 0 ? (
                        <p className="text-xs text-slate-400">No active discounts. Create them under Discounts.</p>
                      ) : (
                        activeDiscounts.map((d) => (
                          <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-[#6C3CE9]"
                              checked={selectedDiscountIds.includes(d.id)}
                              onChange={() => toggleDiscount(d.id)}
                            />
                            <span className="font-medium text-slate-800">{d.name}</span>
                            <span className="text-xs text-slate-500">
                              ({d.code} · {d.type === "percentage" ? `${d.value}%` : `₹${d.value}`})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Manual Discount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={manualDiscount || ""}
                      onChange={(e) => setManualDiscount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Total Discount</label>
                    <input className={inputClass} readOnly value={`₹${discountResult.totalDiscount.toLocaleString("en-IN")}`} />
                  </div>
                  <div>
                    <label className={labelClass}>Payable Fee</label>
                    <input className={inputClass + " font-semibold"} readOnly value={`₹${payableFee.toLocaleString("en-IN")}`} />
                  </div>
                  <div>
                    <label className={labelClass}>Fee Paid (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={feePaid || ""}
                      onChange={(e) => setFeePaid(Number(e.target.value) || 0)}
                      placeholder="Enter amount received to generate receipt"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Receipt generates only when Fee Paid &gt; 0.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Payment Method</label>
                    <select
                      className={inputClass}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  {paymentMethod === "UPI" ? (
                    <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center gap-4">
                      {upiQrValue && feePaid > 0 && settings?.upiId ? (
                        <>
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <QRCodeSVG value={upiQrValue} size={140} level="M" />
                          </div>
                          <div className="text-sm text-slate-700 space-y-1">
                            <p className="font-semibold text-slate-900">
                              Scan to pay ₹{Number(feePaid).toLocaleString("en-IN")}
                            </p>
                            <p>
                              UPI: <span className="font-mono">{settings.upiId}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              Payee: {settings.upiPayeeName || settings.instituteName}
                            </p>
                            <p className="text-xs text-slate-400">
                              Confirm payment in UPI app, then submit admission.
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-amber-700">
                          {feePaid <= 0
                            ? "Enter fee paid amount to generate UPI QR."
                            : "Set Institute UPI ID in Settings to generate payment QR."}
                        </p>
                      )}
                    </div>
                  ) : null}
                  <div className="md:col-span-2">
                    <label className={labelClass}>Notes</label>
                    <input
                      name="notes"
                      className={inputClass}
                      defaultValue={
                        [inquiryPrefill?.description, inquiryPrefill?.internalNotes]
                          .filter(Boolean)
                          .join(" | ") || ""
                      }
                    />
                  </div>
                </div>
              </section>
              <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    clearInquiryLink();
                  }}
                  className={btnSecondaryBlock}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className={btnPrimaryBlock}>
                  {submitting
                    ? "Processing..."
                    : editingAdmission
                      ? "Update Admission"
                      : "Confirm Admission"}
                </button>
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

      <ReceiptPreviewModal
        open={!!receiptSuccess}
        title="Admission Fee Receipt"
        receiptNo={receiptSuccess?.receiptNo || ""}
        studentId={receiptSuccess?.studentId || ""}
        receiptHtml={receiptSuccess?.receiptHtml || ""}
        onClose={() => setReceiptSuccess(null)}
      />
    </PageTransition>
  );
}
