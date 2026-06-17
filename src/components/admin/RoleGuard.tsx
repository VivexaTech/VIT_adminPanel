"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canAccessPath } from "@/lib/rbac";

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (pathname.includes("/login")) return;
    if (!canAccessPath(user.role, pathname)) {
      router.replace("/secure-admin");
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
