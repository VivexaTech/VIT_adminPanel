"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Award, 
  CheckCircle, 
  UserCog, 
  BarChart3, 
  Settings, 
  LogOut,
  Wallet
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const menuItems = [
  { name: "Dashboard", path: "/secure-admin", icon: LayoutDashboard },
  { name: "Admissions", path: "/secure-admin/admissions", icon: FileText },
  { name: "Students", path: "/secure-admin/students", icon: Users },
  { name: "Certificates", path: "/secure-admin/certificates", icon: Award },
  { name: "Fee Management", path: "/secure-admin/fees", icon: Wallet },
  { name: "Verify Tool", path: "/secure-admin/verify", icon: CheckCircle },
  { name: "Users", path: "/secure-admin/users", icon: UserCog },
  { name: "Analytics", path: "/secure-admin/analytics", icon: BarChart3 },
  { name: "Settings", path: "/secure-admin/settings", icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 glass-panel border-r border-cyan-500/20 flex flex-col transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-cyan-500/20">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-glow">
            Vivexa Admin
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <Link key={item.path} href={item.path} onClick={() => setIsOpen(false)}>
                <span className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
                  <Icon size={20} className={isActive ? "text-cyan-400" : "text-gray-400"} />
                  <span className="font-medium">{item.name}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-cyan-500/20">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
