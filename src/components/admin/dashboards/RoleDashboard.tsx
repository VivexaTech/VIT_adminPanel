"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/admin/StatCard";
import {
  Users,
  BookOpen,
  UserCheck,
  MessageSquare,
  ClipboardList,
  CalendarCheck,
  ShieldCheck,
  IndianRupee,
  Video,
  Layers,
  CalendarOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { btnPrimary } from "@/lib/theme";
import { normalizeRole } from "@/lib/rbac";
import { ROLES } from "@/types/rbac";
import { subscribePendingApprovals } from "@/lib/approvalService";
import { filterBatchesForTrainer } from "@/lib/batchService";
import type { Batch } from "@/types/erp";

export default function RoleDashboard() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (role === ROLES.SUPER_ADMIN) return <SuperAdminDashboard />;
  if (role === ROLES.TRAINER) return <TrainerDashboard assignedBatchIds={user?.assignedBatchIds} />;
  return <AdminDepartmentDashboard />;
}

function SuperAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    students: 0,
    trainers: 0,
    admins: 0,
    revenue: 0,
    pendingApprovals: 0,
    certificates: 0,
    avgAttendance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsSnap, usersSnap, feesSnap, certsSnap] = await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "student_fees")),
          getCountFromServer(collection(db, "certificates")),
        ]);

        let trainers = 0;
        let admins = 0;
        usersSnap.docs.forEach((d) => {
          const r = d.data().role;
          if (r === "Trainer" || r === "Teaching Team") trainers += 1;
          else if (r === "Admin") admins += 1;
        });

        let revenue = 0;
        feesSnap.docs.forEach((d) => {
          revenue += Number(d.data().paidAmount) || 0;
        });

        let attSum = 0;
        let attN = 0;
        studentsSnap.docs.forEach((d) => {
          const pct = d.data().enrolledCourse?.attendancePercentage;
          if (typeof pct === "number") {
            attSum += pct;
            attN += 1;
          }
        });

        setStats({
          students: studentsSnap.size,
          trainers,
          admins,
          revenue,
          pendingApprovals: 0,
          certificates: certsSnap.data().count,
          avgAttendance: attN ? Math.round(attSum / attN) : 0,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    return subscribePendingApprovals((r) =>
      setStats((s) => ({ ...s, pendingApprovals: r.length }))
    );
  }, []);

  if (loading) return <DashboardLoader />;

  return (
    <DashboardShell user={user}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard title="Total Students" value={stats.students} icon={Users} accent="blue" delay={0.05} />
        <StatCard title="Trainers" value={stats.trainers} icon={UserCheck} accent="green" delay={0.1} />
        <StatCard title="Admins" value={stats.admins} icon={Users} accent="purple" delay={0.15} />
        <StatCard title="Total Revenue" value={`₹${stats.revenue.toLocaleString("en-IN")}`} icon={IndianRupee} accent="amber" delay={0.2} />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={ShieldCheck} accent="rose" delay={0.25} />
        <StatCard title="Certificates" value={stats.certificates} icon={ClipboardList} accent="blue" delay={0.3} />
        <StatCard title="Avg. Attendance" value={`${stats.avgAttendance}%`} icon={CalendarCheck} accent="green" delay={0.35} />
      </div>
      <QuickLinks
        links={[
          { href: "/secure-admin/approvals", label: "Review Approvals" },
          { href: "/secure-admin/users", label: "Manage Users" },
          { href: "/secure-admin/audit-logs", label: "Audit Logs" },
          { href: "/secure-admin/analytics", label: "Reports" },
        ]}
      />
    </DashboardShell>
  );
}

function AdminDepartmentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    admissions: 0,
    enquiries: 0,
    feePending: 0,
    courses: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [admSnap, enqSnap, feesSnap, courseSnap, stuSnap] = await Promise.all([
        getDocs(collection(db, "admissions")),
        getCountFromServer(collection(db, "course_enquiries")),
        getDocs(query(collection(db, "student_fees"), where("paymentStatus", "in", ["Pending", "Partial"]))),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "students")),
      ]);
      setStats({
        admissions: admSnap.size,
        enquiries: enqSnap.data().count,
        feePending: feesSnap.size,
        courses: courseSnap.size,
        students: stuSnap.size,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <DashboardLoader />;

  return (
    <DashboardShell user={user}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
        <StatCard title="Admissions" value={stats.admissions} icon={UserCheck} accent="purple" delay={0.05} />
        <StatCard title="Enquiries" value={stats.enquiries} icon={MessageSquare} accent="amber" delay={0.1} />
        <StatCard title="Fee Records Pending" value={stats.feePending} icon={IndianRupee} accent="rose" delay={0.15} />
        <StatCard title="Courses" value={stats.courses} icon={BookOpen} accent="blue" delay={0.2} />
        <StatCard title="Students" value={stats.students} icon={Users} accent="green" delay={0.25} />
      </div>
      <QuickLinks
        links={[
          { href: "/secure-admin/admissions", label: "Create Admission" },
          { href: "/secure-admin/fees", label: "Fee Records" },
          { href: "/secure-admin/students", label: "Manage Students" },
          { href: "/secure-admin/enquiries", label: "Enquiries" },
        ]}
      />
    </DashboardShell>
  );
}

function TrainerDashboard({ assignedBatchIds }: { assignedBatchIds?: string[] }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    batches: 0,
    classesToday: 0,
    leavePending: 0,
    tests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [batchSnap, leaveSnap, testSnap, classSnap] = await Promise.all([
        getDocs(collection(db, "batches")),
        getDocs(query(collection(db, "leave_requests"), where("status", "==", "pending"))),
        getDocs(collection(db, "institute_tests")),
        getDocs(collection(db, "class_sessions")),
      ]);

      const allBatches = batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Batch[];
      const myBatches = filterBatchesForTrainer(allBatches, assignedBatchIds);
      const today = new Date().toISOString().slice(0, 10);
      const todayClasses = classSnap.docs.filter((d) => d.data().date === today).length;

      setStats({
        batches: myBatches.length,
        classesToday: todayClasses,
        leavePending: leaveSnap.size,
        tests: testSnap.size,
      });
      setLoading(false);
    };
    load();
  }, [assignedBatchIds]);

  if (loading) return <DashboardLoader />;

  return (
    <DashboardShell user={user} subtitle="Your teaching operations at a glance.">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard title="Assigned Batches" value={stats.batches} icon={Layers} accent="purple" delay={0.05} />
        <StatCard title="Today's Classes" value={stats.classesToday} icon={Video} accent="blue" delay={0.1} />
        <StatCard title="Tests" value={stats.tests} icon={ClipboardList} accent="blue" delay={0.15} />
        <StatCard title="Leave Requests" value={stats.leavePending} icon={CalendarOff} accent="amber" delay={0.2} />
      </div>
      <QuickLinks
        links={[
          { href: "/secure-admin/classes", label: "Live Classes" },
          { href: "/secure-admin/attendance", label: "Mark Attendance" },
          { href: "/secure-admin/assignments", label: "Review Assignments" },
          { href: "/secure-admin/leaves", label: "Leave Requests" },
        ]}
      />
    </DashboardShell>
  );
}

function DashboardShell({
  user,
  subtitle,
  children,
}: {
  user: ReturnType<typeof useAuth>["user"];
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Welcome back, <span className="brand-text">{user?.fullName || "Admin"}</span>
        </h1>
        <p className="text-slate-500 mt-1">{subtitle || "Live overview of your institute operations."}</p>
      </div>
      {children}
    </>
  );
}

function QuickLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="glass-card p-6 rounded-2xl">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={btnPrimary + " text-center"}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="w-10 h-10 border-3 border-[#6C3CE9] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
