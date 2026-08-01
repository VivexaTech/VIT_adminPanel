"use client";

import type { ComponentType } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import type { Inquiry, InquiryDashboardStats } from "@/types/inquiry";
import {
  getInquiryCreatedDate,
  isFollowUpOverdue,
  isFollowUpToday,
  isFollowUpTomorrow,
} from "@/lib/inquiryService";
import { INQUIRY_STATUS_STYLES } from "@/types/inquiry";

const PIE_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#64748B", "#06B6D4"];

type Props = {
  stats: InquiryDashboardStats;
  inquiries: Inquiry[];
  onSelectInquiry: (id: string) => void;
};

function StatMini({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-xl ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function InquiryOverview({ stats, inquiries, onSelectInquiry }: Props) {
  const todayList = inquiries.filter((i) => isFollowUpToday(i));
  const tomorrowList = inquiries.filter((i) => isFollowUpTomorrow(i));
  const overdueList = inquiries.filter((i) => isFollowUpOverdue(i));

  const monthlyMap = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }
  for (const inq of inquiries) {
    const created = getInquiryCreatedDate(inq);
    if (!created) continue;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  }
  const monthlyData = [...monthlyMap.entries()].map(([name, value]) => ({ name, value }));

  const courseMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  for (const inq of inquiries) {
    const course = inq.courseTitle || "Unspecified";
    courseMap.set(course, (courseMap.get(course) || 0) + 1);
    const source = inq.source || "Unknown";
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    statusMap.set(inq.status, (statusMap.get(inq.status) || 0) + 1);
  }
  const courseData = [...courseMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const sourceData = [...sourceMap.entries()].map(([name, value]) => ({ name, value }));
  const statusData = [...statusMap.entries()].map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatMini title="Total Inquiries" value={stats.total} icon={Users} accent="bg-blue-500" />
        <StatMini title="Today's Inquiries" value={stats.today} icon={UserPlus} accent="bg-violet-500" />
        <StatMini title="This Month" value={stats.thisMonth} icon={ClipboardList} accent="bg-indigo-500" />
        <StatMini title="Pending Follow-ups" value={stats.pendingFollowUps} icon={CalendarClock} accent="bg-amber-500" />
        <StatMini title="Today's Follow-ups" value={stats.todayFollowUps} icon={CalendarCheck} accent="bg-teal-500" />
        <StatMini title="Overdue Follow-ups" value={stats.overdueFollowUps} icon={AlertTriangle} accent="bg-red-500" />
        <StatMini title="Interested" value={stats.interested} icon={Users} accent="bg-violet-600" />
        <StatMini title="Admission Confirmed" value={stats.admissionConfirmed} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatMini title="Cancelled" value={stats.cancelled} icon={XCircle} accent="bg-slate-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReminderColumn
          title="Today's Follow-ups"
          items={todayList}
          empty="No follow-ups due today."
          accent="border-teal-200"
          onSelect={onSelectInquiry}
        />
        <ReminderColumn
          title="Tomorrow's Follow-ups"
          items={tomorrowList}
          empty="Nothing scheduled for tomorrow."
          accent="border-amber-200"
          onSelect={onSelectInquiry}
        />
        <ReminderColumn
          title="Overdue Follow-ups"
          items={overdueList}
          empty="No overdue follow-ups."
          accent="border-red-200"
          highlight
          onSelect={onSelectInquiry}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Monthly Inquiry Report</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6C3CE9" strokeWidth={2} name="Inquiries" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Course Wise Inquiry</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6C3CE9" radius={[0, 6, 6, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Inquiry Source Wise</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {sourceData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Status Wise Report</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#00C9A7" radius={[6, 6, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderColumn({
  title,
  items,
  empty,
  accent,
  highlight,
  onSelect,
}: {
  title: string;
  items: Inquiry[];
  empty: string;
  accent: string;
  highlight?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={`glass-card rounded-2xl p-4 border ${accent}`}>
      <h3 className={`text-sm font-semibold mb-3 ${highlight ? "text-red-700" : "text-slate-800"}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {items.slice(0, 12).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onSelect(i.id)}
                className="w-full text-left rounded-xl px-3 py-2 hover:bg-slate-50 border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{i.fullName}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${INQUIRY_STATUS_STYLES[i.status]}`}>
                    {i.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {i.phone} · {i.nextAction || "Follow-up"} · {i.nextFollowUpDate}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
