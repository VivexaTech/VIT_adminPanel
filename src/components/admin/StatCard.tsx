"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  accent?: "purple" | "green" | "blue" | "amber" | "rose";
  delay?: number;
}

const accents = {
  purple: "from-[#6C3CE9]/10 to-[#9B5DE5]/5 border-violet-200 text-[#6C3CE9]",
  green: "from-emerald-500/10 to-emerald-500/5 border-emerald-200 text-emerald-600",
  blue: "from-blue-500/10 to-blue-500/5 border-blue-200 text-blue-600",
  amber: "from-amber-500/10 to-amber-500/5 border-amber-200 text-amber-600",
  rose: "from-rose-500/10 to-rose-500/5 border-rose-200 text-rose-600",
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendUp,
  accent = "purple",
  delay = 0,
}: StatCardProps) {
  const style = accents[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`glass-card p-4 sm:p-5 rounded-2xl border bg-gradient-to-br ${style}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-sm font-medium">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${trendUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {trend}
            </span>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-white border flex items-center justify-center shadow-sm ${style.split(" ").pop()}`}>
          <Icon size={22} />
        </div>
      </div>
    </motion.div>
  );
}
