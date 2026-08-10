import { auth } from "@/lib/firebase";

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = await getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export type CreateStudentPayload = {
  studentId?: string;
  fullName: string;
  parentName?: string;
  email: string;
  phone: string;
  password: string;
  course: string;
  courseId?: string;
  batch?: string;
  status?: string;
};

export type AdmissionCourseItem = {
  courseId: string;
  courseTitle: string;
  batch?: string;
  batchId?: string;
};

export type CreateAdmissionPayload = {
  fullName: string;
  parentName?: string;
  fatherName?: string;
  email: string;
  phone: string;
  password?: string;
  /** Primary / first course (backward compatible) */
  courseId: string;
  courseTitle: string;
  /** Multiple courses in one admission */
  courses?: AdmissionCourseItem[];
  /** Display / certificate name e.g. "Python with React" */
  courseDisplayName?: string;
  batch?: string;
  batchId?: string;
  qualification?: string;
  address?: string;
  city?: string;
  state?: string;
  admissionDate?: string;
  courseDuration?: string;
  nextDueDate?: string;
  totalCourseFee?: number;
  /** Final discount amount in ₹ */
  discount?: number;
  /** Selected discount document IDs */
  discountIds?: string[];
  /** Extra manual discount in ₹ */
  manualDiscount?: number;
  discountBreakdown?: {
    items: { id: string; code: string; name: string; type: string; value: number; amountApplied: number }[];
    manualAmount: number;
  };
  admissionFeePaid?: number;
  paymentMethod?: string;
  notes?: string;
  /** When set, links admission back to institute inquiry and marks it confirmed */
  inquiryId?: string;
  studentPhotoUrl?: string;
  aadhaarUrl?: string;
};

export type CreateStaffUserPayload = {
  fullName: string;
  email: string;
  role: string;
  useGeneratedPassword?: boolean;
  password?: string;
  status?: string;
};

export const adminApi = {
  createStaffUser: (payload: CreateStaffUserPayload) =>
    adminFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  resetStaffPassword: (email: string, opts?: { useGeneratedPassword?: boolean; password?: string }) =>
    adminFetch(`/api/admin/users/${encodeURIComponent(email)}/reset-password`, {
      method: "POST",
      body: JSON.stringify(opts || { useGeneratedPassword: true }),
    }),

  setStaffStatus: (email: string, status: "active" | "suspended") =>
    adminFetch(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteStaffUser: (email: string) =>
    adminFetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: "DELETE" }),

  changePassword: (newPassword: string) =>
    adminFetch("/api/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),

  createAdmission: (payload: CreateAdmissionPayload) =>
    adminFetch("/api/admin/admissions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAdmission: (admissionId: string, payload: Record<string, unknown>) =>
    adminFetch(`/api/admin/admissions/${encodeURIComponent(admissionId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  seedCategories: () =>
    adminFetch("/api/admin/categories/seed", { method: "POST" }),

  fetchCategories: () => adminFetch("/api/admin/categories"),

  createCategory: (payload: { name: string; iconName?: string; order?: number; active?: boolean }) =>
    adminFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(payload) }),

  updateCategory: (payload: { id: string; name?: string; iconName?: string; order?: number; active?: boolean }) =>
    adminFetch("/api/admin/categories", { method: "PATCH", body: JSON.stringify(payload) }),

  deleteCategory: (id: string) =>
    adminFetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  sendFeeReceiptEmail: (payload: {
    to: string;
    studentName: string;
    receiptHtml: string;
    receiptNo: string;
  }) =>
    adminFetch("/api/admin/fees/receipt", { method: "POST", body: JSON.stringify(payload) }),

  createStudent: (payload: CreateStudentPayload) =>
    adminFetch("/api/admin/students", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteStudent: (studentId: string) =>
    adminFetch(`/api/admin/students/${studentId}`, { method: "DELETE" }),

  resetPassword: (
    studentId: string,
    opts?: { password?: string; useGeneratedPassword?: boolean; forcePasswordChange?: boolean }
  ) =>
    adminFetch(`/api/admin/students/${studentId}/reset-password`, {
      method: "POST",
      body: JSON.stringify(opts || {}),
    }),

  setStudentStatus: (studentId: string, status: string, disabled?: boolean) =>
    adminFetch(`/api/admin/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, disabled }),
    }),

  deleteRecording: (recordingId: string) =>
    adminFetch("/api/admin/recordings/delete", {
      method: "POST",
      body: JSON.stringify({ recordingId }),
    }),
};
