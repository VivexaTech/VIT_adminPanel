"use client";

import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/types/rbac";

export default function PermissionGate({
  permission,
  superAdminOnly,
  fallback = null,
  children,
}: {
  permission?: Permission;
  superAdminOnly?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, isSuperAdmin } = usePermissions();

  if (superAdminOnly && !isSuperAdmin) return <>{fallback}</>;
  if (permission && !can(permission)) return <>{fallback}</>;

  return <>{children}</>;
}
