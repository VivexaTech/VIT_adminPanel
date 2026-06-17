import type { Permission, UserRole } from "@/types/rbac";
import { ROLES } from "@/types/rbac";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "manage_users",
  "manage_students",
  "manage_courses",
  "manage_admissions",
  "manage_fees",
  "manage_certificates",
  "manage_tests",
  "manage_batches",
  "manage_classes",
  "manage_attendance",
  "manage_assignments",
  "manage_materials",
  "manage_recordings",
  "manage_enquiries",
  "manage_settings",
  "view_reports",
  "view_audit_logs",
  "manage_approvals",
  "manage_leaves",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.ADMIN]: [
    "dashboard",
    "manage_students",
    "manage_courses",
    "manage_admissions",
    "manage_fees",
    "manage_certificates",
    "manage_tests",
    "manage_batches",
    "manage_classes",
    "manage_enquiries",
    "manage_materials",
    "view_reports",
  ],
  [ROLES.TRAINER]: [
    "dashboard",
    "manage_batches",
    "manage_classes",
    "manage_attendance",
    "manage_tests",
    "manage_assignments",
    "manage_materials",
    "manage_recordings",
    "manage_leaves",
  ],
};

export const APPROVAL_REQUIRED_ACTIONS = [
  "student_delete",
  "fee_modification",
  "admission_cancel",
  "certificate_cancel",
  "batch_delete",
  "course_delete",
] as const;

export type ApprovalRequiredAction = (typeof APPROVAL_REQUIRED_ACTIONS)[number];

export function normalizeRole(role?: string | null): UserRole {
  if (role === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (role === ROLES.TRAINER || role === "Teaching Team") return ROLES.TRAINER;
  return ROLES.ADMIN;
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized]?.includes(permission) ?? false;
}

export function isSuperAdmin(role?: string | null): boolean {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function requiresApproval(role: string | undefined | null, action: ApprovalRequiredAction): boolean {
  if (isSuperAdmin(role)) return false;
  return APPROVAL_REQUIRED_ACTIONS.includes(action);
}

export interface NavItem {
  name: string;
  path: string;
  permission?: Permission;
  superAdminOnly?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { name: "Dashboard", path: "/secure-admin", permission: "dashboard" },
  { name: "Courses", path: "/secure-admin/courses", permission: "manage_courses" },
  { name: "Students", path: "/secure-admin/students", permission: "manage_students" },
  { name: "Admissions", path: "/secure-admin/admissions", permission: "manage_admissions" },
  { name: "Batches", path: "/secure-admin/batches", permission: "manage_batches" },
  { name: "Live Classes", path: "/secure-admin/classes", permission: "manage_classes" },
  { name: "Tests", path: "/secure-admin/tests", permission: "manage_tests" },
  { name: "Attendance", path: "/secure-admin/attendance", permission: "manage_attendance" },
  { name: "Assignments", path: "/secure-admin/assignments", permission: "manage_assignments" },
  { name: "Recordings", path: "/secure-admin/recordings", permission: "manage_recordings" },
  { name: "Study Materials", path: "/secure-admin/materials", permission: "manage_materials" },
  { name: "Leave Requests", path: "/secure-admin/leaves", permission: "manage_leaves" },
  { name: "Certificates", path: "/secure-admin/certificates", permission: "manage_certificates" },
  { name: "Enquiries", path: "/secure-admin/enquiries", permission: "manage_enquiries" },
  { name: "Settings", path: "/secure-admin/settings", permission: "manage_settings" },
];

export const MORE_NAV: NavItem[] = [
  { name: "Fee Management", path: "/secure-admin/fees", permission: "manage_fees" },
  { name: "Approvals", path: "/secure-admin/approvals", permission: "manage_approvals", superAdminOnly: true },
  { name: "Admin Users", path: "/secure-admin/users", permission: "manage_users", superAdminOnly: true },
  { name: "Audit Logs", path: "/secure-admin/audit-logs", permission: "view_audit_logs", superAdminOnly: true },
  { name: "Analytics", path: "/secure-admin/analytics", permission: "view_reports" },
  { name: "Verify Tool", path: "/secure-admin/verify", permission: "manage_certificates" },
];

export function getNavForRole(role?: string | null): { primary: NavItem[]; more: NavItem[] } {
  const filter = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.superAdminOnly && !isSuperAdmin(role)) return false;
      if (!item.permission) return true;
      return hasPermission(role, item.permission);
    });

  return { primary: filter(PRIMARY_NAV), more: filter(MORE_NAV) };
}

export function canAccessPath(role: string | undefined | null, pathname: string): boolean {
  const all = [...PRIMARY_NAV, ...MORE_NAV];
  const match = all
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (!match) return true;
  if (match.superAdminOnly && !isSuperAdmin(role)) return false;
  if (match.permission) return hasPermission(role, match.permission);
  return true;
}
