export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TRAINER: "Trainer",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export type Permission =
  | "dashboard"
  | "manage_users"
  | "manage_students"
  | "manage_courses"
  | "manage_admissions"
  | "manage_fees"
  | "manage_certificates"
  | "manage_tests"
  | "manage_batches"
  | "manage_classes"
  | "manage_attendance"
  | "manage_assignments"
  | "manage_materials"
  | "manage_recordings"
  | "manage_enquiries"
  | "manage_settings"
  | "view_reports"
  | "view_audit_logs"
  | "manage_approvals"
  | "manage_leaves";

export type ApprovalActionType =
  | "student_delete"
  | "fee_modification"
  | "admission_cancel"
  | "certificate_cancel"
  | "batch_delete"
  | "course_delete";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AdminUserProfile {
  id: string;
  uid?: string;
  staffId?: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active" | "suspended";
  mustChangePassword?: boolean;
  assignedBatchIds?: string[];
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestDate: string;
  remarks?: string;
  targetId?: string;
  targetLabel?: string;
  payload: Record<string, unknown>;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  ip?: string;
  createdAt: unknown;
}
