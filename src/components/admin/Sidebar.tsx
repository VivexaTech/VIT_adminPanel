"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  CalendarCheck,
  Award,
  MessageSquare,
  UserPlus,
  Layers,
  Video,
  CalendarOff,
  Film,
  FileText,
  PenLine,
  Settings,
  LogOut,
  ChevronDown,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { getNavForRole } from "@/lib/rbac";
import { subscribePendingApprovals } from "@/lib/approvalService";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Dashboard: LayoutDashboard,
  Courses: BookOpen,
  Students: Users,
  Admissions: UserPlus,
  Batches: Layers,
  "Live Classes": Video,
  Tests: ClipboardList,
  Attendance: CalendarCheck,
  Assignments: PenLine,
  Recordings: Film,
  "Study Materials": FileText,
  "Leave Requests": CalendarOff,
  Certificates: Award,
  Enquiries: MessageSquare,
  Settings: Settings,
  "Fee Management": Award,
  Approvals: ShieldCheck,
  "Admin Users": Users,
  "Audit Logs": ScrollText,
  Analytics: ClipboardList,
  "Verify Tool": Award,
};

export default function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const { primary, more } = getNavForRole(user?.role);

  useEffect(() => {
    if (user?.role !== "Super Admin") return;
    return subscribePendingApprovals((requests) => setPendingCount(requests.length));
  }, [user?.role]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/30 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:translate-x-0 shadow-sm ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center text-white font-bold text-lg shadow-sm">
              V
            </div>
            <div>
              <h2 className="text-lg font-bold brand-text">Vivexa</h2>
              <p className="text-xs text-slate-500">{user?.role || "Admin Panel"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {primary.map((item) => {
            const isActive =
              item.path === "/secure-admin"
                ? pathname === item.path
                : pathname === item.path || pathname.startsWith(`${item.path}/`);
            const Icon = ICONS[item.name] || LayoutDashboard;

            return (
              <Link key={item.path} href={item.path} onClick={() => setIsOpen(false)}>
                <span
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#EDE7FF] text-[#6C3CE9] font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={20} className={isActive ? "text-[#6C3CE9]" : "text-slate-400"} />
                  <span>{item.name}</span>
                </span>
              </Link>
            );
          })}

          {more.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 mt-2"
              >
                <span className="text-sm font-medium">More Tools</span>
                <ChevronDown size={16} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">
                  {more.map((item) => (
                    <Link key={item.path} href={item.path} onClick={() => setIsOpen(false)}>
                      <span
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                          pathname === item.path || pathname.startsWith(`${item.path}/`)
                            ? "text-[#6C3CE9] font-medium bg-[#EDE7FF]/50"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <span>{item.name}</span>
                        {item.name === "Approvals" && pendingCount > 0 && (
                          <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                            {pendingCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.fullName || "Admin"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
