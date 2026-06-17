"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <div className="min-w-0 lg:hidden">
          <p className="text-sm font-medium text-slate-800 truncate">Vivexa Admin</p>
          <p className="text-xs text-slate-400 truncate hidden xs:block">Education Management</p>
        </div>

        <div className="hidden lg:block shrink-0">
          <p className="text-sm text-slate-500">Vivexa Institute of Technology</p>
          <p className="text-xs text-slate-400">Education Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium ${
            user?.role === "Super Admin"
              ? "bg-violet-100 text-violet-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {user?.role || "Admin"}
        </span>
        <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {(user?.fullName || "A").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
