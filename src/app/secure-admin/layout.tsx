"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";
import ProtectedRoute from "@/components/admin/ProtectedRoute";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  
  const isLoginPage = pathname === "/secure-admin/login";

  return (
    <ProtectedRoute>
      <div className={`flex h-screen bg-[#050B14] overflow-hidden text-white font-sans selection:bg-cyan-500/30`}>
        
        {/* Background Gradients */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none z-0"></div>

        {!isLoginPage && <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />}
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          {!isLoginPage && <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}
          
          <main className={`flex-1 overflow-y-auto scroll-smooth ${!isLoginPage ? 'p-4 md:p-6 lg:p-8' : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
