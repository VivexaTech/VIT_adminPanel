"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-slate-200 rounded-xl text-sm shadow-sm">
        <p className="text-slate-900 font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [coursePopularity, setCoursePopularity] = useState<any[]>([]);
  const [admissionsData, setAdmissionsData] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    
    const fetchAnalyticsData = async () => {
      try {
        // Fetch Students for Course Popularity
        const studentsSnap = await getDocs(collection(db, "students"));
        const coursesCount: Record<string, number> = {};
        
        studentsSnap.forEach((doc) => {
          const course = doc.data().course || "Unknown";
          coursesCount[course] = (coursesCount[course] || 0) + 1;
        });
        
        const popularity = Object.entries(coursesCount).map(([name, count]) => ({
          name,
          students: count
        })).sort((a, b) => b.students - a.students); // Sort by highest
        
        setCoursePopularity(popularity);

        // Fetch Admissions for Growth Trend (Mocking past months based on real data dates)
        const admissionsSnap = await getDocs(collection(db, "admissions"));
        const monthsCount: Record<string, number> = {};
        
        // Initialize last 6 months to 0 for a continuous graph
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          monthsCount[`${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`] = 0;
        }

        admissionsSnap.forEach((doc) => {
          const dateStr = doc.data().date;
          if (dateStr) {
            const d = new Date(dateStr);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
            if (monthsCount[key] !== undefined) {
              monthsCount[key] += 1;
            }
          }
        });

        const admissions = Object.entries(monthsCount).map(([name, count]) => ({
          name,
          admissions: count
        }));
        
        setAdmissionsData(admissions);

      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  return (
    <PageTransition>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Analytics Overview</h1>
        <p className="text-slate-500 text-sm">Visual metrics of institute performance powered by live data.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-[#6C3CE9] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="glass-card p-4 sm:p-6 rounded-2xl">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6">Admissions Growth (6 Months)</h2>
            <div className="h-[300px] w-full">
              {admissionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={admissionsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="admissions" 
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#050B14' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No admission data available</div>
              )}
            </div>
          </div>

          {/* Course Popularity Bar */}
          <div className="glass-card p-4 sm:p-6 rounded-2xl">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6">Course Popularity</h2>
            <div className="h-[300px] w-full">
              {coursePopularity.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coursePopularity} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#e5e7eb" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                    <Bar dataKey="students" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {coursePopularity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No student data available</div>
              )}
            </div>
          </div>

          {/* Certificates Distribution Pie */}
          <div className="glass-card p-4 sm:p-6 rounded-2xl lg:col-span-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6">Student Distribution</h2>
            <div className="h-[300px] w-full flex justify-center">
              {coursePopularity.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={coursePopularity}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="students"
                      stroke="none"
                    >
                      {coursePopularity.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No student data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
