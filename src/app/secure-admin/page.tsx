"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import StatCard from "@/components/admin/StatCard";
import { Users, Award, FileText, Wallet, Banknote, UserCog, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAdmissions: 0,
    totalCertificates: 0,
    totalUsers: 0,
    totalRevenue: 0,
    pendingFees: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch Counts in parallel
        const [
          studentsSnap,
          admissionsSnap,
          certsSnap,
          usersSnap,
          feesSnap
        ] = await Promise.all([
          getCountFromServer(collection(db, "students")),
          getCountFromServer(collection(db, "admissions")),
          getCountFromServer(collection(db, "certificates")),
          getCountFromServer(collection(db, "users")),
          getDocs(collection(db, "student_fees"))
        ]);

        let revenue = 0;
        let pending = 0;
        feesSnap.docs.forEach(doc => {
          const data = doc.data();
          revenue += (data.paidAmount || 0);
          pending += (data.remainingFee || 0);
        });

        setStats({
          totalStudents: studentsSnap.data().count,
          totalAdmissions: admissionsSnap.data().count,
          totalCertificates: certsSnap.data().count,
          totalUsers: usersSnap.data().count,
          totalRevenue: revenue,
          pendingFees: pending,
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <PageTransition>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{user?.fullName || 'Admin'}</span>
          </h1>
          <p className="text-gray-400">Here's your live ERP data overview for Vivexa Institute.</p>
        </div>
        <div className="hidden md:block">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            user?.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
            'bg-blue-500/10 text-blue-400 border-blue-500/20'
          }`}>
            Role: {user?.role || 'Admin'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            <StatCard 
              title="Total Admissions" 
              value={stats.totalAdmissions} 
              icon={FileText} 
              delay={0.1} 
            />
            <StatCard 
              title="Total Students" 
              value={stats.totalStudents} 
              icon={Users} 
              delay={0.2} 
            />
            <StatCard 
              title="Total Revenue" 
              value={formatCurrency(stats.totalRevenue)} 
              icon={Wallet} 
              delay={0.3} 
            />
            <StatCard 
              title="Pending Fees" 
              value={formatCurrency(stats.pendingFees)} 
              icon={Banknote} 
              delay={0.4} 
              trendUp={false}
            />
            <StatCard 
              title="Certificates Issued" 
              value={stats.totalCertificates} 
              icon={Award} 
              delay={0.5} 
            />
            <StatCard 
              title="Admin Users" 
              value={stats.totalUsers} 
              icon={UserCog} 
              delay={0.6} 
            />
          </div>

          {/* Quick Actions */}
          <div className="glass-panel p-6 rounded-2xl mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="text-cyan-400" size={20} />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/secure-admin/admissions" className="block w-full p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 hover:border-cyan-400 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">New Admission</p>
                    <p className="text-xs text-gray-400 mt-1">Register new student</p>
                  </div>
                  <FileText size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
              </Link>
              <Link href="/secure-admin/fees" className="block w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-600/10 border border-emerald-500/30 hover:border-emerald-400 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white group-hover:text-emerald-400 transition-colors">Manage Fees</p>
                    <p className="text-xs text-gray-400 mt-1">Collect payments</p>
                  </div>
                  <Wallet size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
              </Link>
              <Link href="/secure-admin/certificates" className="block w-full p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-600/10 border border-purple-500/30 hover:border-purple-400 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white group-hover:text-purple-400 transition-colors">Issue Certificate</p>
                    <p className="text-xs text-gray-400 mt-1">Generate credentials</p>
                  </div>
                  <Award size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
}
