"use client";

import { useAuth } from "@/context/AuthContext";
import {
  canAccessPath,
  hasPermission,
  isSuperAdmin,
  requiresApproval,
  type ApprovalRequiredAction,
} from "@/lib/rbac";
import type { Permission } from "@/types/rbac";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    user,
    role,
    isSuperAdmin: isSuperAdmin(role),
    isTrainer: role === "Trainer" || role === "Teaching Team",
    isAdmin: role === "Admin",
    can: (permission: Permission) => hasPermission(role, permission),
    canAccess: (pathname: string) => canAccessPath(role, pathname),
    needsApproval: (action: ApprovalRequiredAction) => requiresApproval(role, action),
    assignedBatchIds: user?.assignedBatchIds || [],
  };
}
