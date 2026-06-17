"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const CHANGE_PASSWORD_PATH = "/secure-admin/change-password";
const LOGIN_PATH = "/secure-admin/login";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== LOGIN_PATH) {
      router.push(LOGIN_PATH);
      return;
    }

    if (user && pathname === LOGIN_PATH) {
      if (user.mustChangePassword) {
        router.push(CHANGE_PASSWORD_PATH);
      } else {
        router.push("/secure-admin");
      }
      return;
    }

    if (
      user?.mustChangePassword &&
      pathname !== CHANGE_PASSWORD_PATH &&
      pathname !== LOGIN_PATH
    ) {
      router.push(CHANGE_PASSWORD_PATH);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#6C3CE9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && pathname !== LOGIN_PATH) {
    return null;
  }

  if (user?.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH && pathname !== LOGIN_PATH) {
    return null;
  }

  return <>{children}</>;
}
