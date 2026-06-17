"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import RoleGuard from "@/components/admin/RoleGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isLoginPage = pathname === "/secure-admin/login";

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-[#F4F6FA] overflow-hidden text-slate-900 font-sans">
        <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#6C3CE9]/5 blur-[120px] pointer-events-none z-0" />
        <div className="fixed bottom-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#9B5DE5]/5 blur-[120px] pointer-events-none z-0" />

        {!isLoginPage && <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          {!isLoginPage && <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}
          <main
            className={`flex-1 overflow-y-auto overflow-x-hidden scroll-smooth ${
              !isLoginPage ? "p-3 sm:p-4 md:p-6 lg:p-8" : ""
            }`}
          >
            {!isLoginPage ? (
              <RoleGuard>
                <div className="admin-page">{children}</div>
              </RoleGuard>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
