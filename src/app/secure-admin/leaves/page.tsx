"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { subscribeToLeaveRequests, updateLeaveStatus } from "@/lib/leaveService";
import { createStudentNotification } from "@/lib/notificationService";
import { useToast } from "@/context/ToastContext";
import { inputClass } from "@/lib/theme";
import { CalendarOff, Search } from "lucide-react";
import type { LeaveRequest } from "@/types/erp";

export default function LeavesPage() {
  const { showToast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => subscribeToLeaveRequests(setLeaves), []);

  const filtered = leaves.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.studentName?.toLowerCase().includes(q) ||
      l.courseTitle?.toLowerCase().includes(q) ||
      l.batchName?.toLowerCase().includes(q) ||
      l.batchId?.toLowerCase().includes(q)
    );
  });

  const handleStatus = async (leave: LeaveRequest, status: "approved" | "rejected") => {
    try {
      await updateLeaveStatus(leave.id, status);
      try {
        await createStudentNotification({
          studentId: leave.studentId,
          type: status === "approved" ? "leave_approval" : "leave_rejection",
          title: status === "approved" ? "Leave Approved" : "Leave Rejected",
          message: `Your leave for ${leave.leaveDate} (${leave.batchName || leave.batchId || "batch"}) was ${status}.`,
          route: "/(tabs)/class",
        });
      } catch {
        /* notification optional */
      }
      showToast("success", `Leave ${status} for ${leave.batchName || leave.batchId || "batch"}.`);
    } catch {
      showToast("error", "Failed to update leave.");
    }
  };

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarOff className="text-[#6C3CE9]" size={26} /> Leave Requests
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review leave applications batch-wise. Approving one batch does not change another.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className={inputClass + " pl-10"}
          placeholder="Search student, course, batch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Batch</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Reason</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No leave requests.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="px-5 py-4 font-medium">{l.studentName}</td>
                    <td className="px-5 py-4 text-sm">
                      {l.batchName || l.batchId || "—"}
                      {l.leaveScope === "all" ? (
                        <span className="block text-[10px] text-slate-400">Part of All Batches request</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm">{l.courseTitle || "—"}</td>
                    <td className="px-5 py-4 text-sm">{l.leaveDate}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">{l.reason}</td>
                    <td className="px-5 py-4 capitalize text-sm">{l.status}</td>
                    <td className="px-5 py-4 text-right gap-1">
                      {l.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleStatus(l, "approved")}
                            className="px-2 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-600 mr-1"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatus(l, "rejected")}
                            className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-600"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageTransition>
  );
}
