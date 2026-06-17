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
  rollNumber?: string;
  status?: string;
};

export type CreateAdmissionPayload = {
  fullName: string;
  parentName?: string;
  fatherName?: string;
  email: string;
  phone: string;
  password?: string;
  courseId: string;
  courseTitle: string;
  batch?: string;
  rollNumber?: string;
  qualification?: string;
  address?: string;
  city?: string;
  state?: string;
  admissionDate?: string;
  courseDuration?: string;
  nextDueDate?: string;
  totalCourseFee?: number;
  discount?: number;
  admissionFeePaid?: number;
  paymentMethod?: string;
  notes?: string;
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
