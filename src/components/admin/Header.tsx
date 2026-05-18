"use client";

import { Menu, Bell, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={24} />
        </button>
        
        <div className="hidden md:flex items-center gap-2 bg-[#0A1121] border border-cyan-500/30 rounded-full px-4 py-2 w-64 focus-within:border-cyan-400 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all">
          <Search size={18} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 relative text-gray-400 hover:text-cyan-400 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-cyan-500/20">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">Admin</p>
            <p className="text-xs text-cyan-400">{user?.email || "contact@vivexatech.in"}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            V
          </div>
        </div>
      </div>
    </header>
  );
}
