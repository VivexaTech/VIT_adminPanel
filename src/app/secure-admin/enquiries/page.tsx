"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { Search, MessageSquare } from "lucide-react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { inputClass } from "@/lib/theme";

type CourseEnquiry = {
  id: string;
  studentName?: string;
  email?: string;
  phone?: string;
  courseId?: string;
  courseTitle?: string;
  status?: "pending" | "contacted" | "converted";
  createdAt?: { toDate?: () => Date };
};

function formatDate(ts?: CourseEnquiry["createdAt"]): string {
  if (!ts?.toDate) return "—";
  try {
    return ts.toDate().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  converted: "bg-emerald-100 text-emerald-700",
};

export default function EnquiriesPage() {
  const { showToast } = useToast();
  const [enquiries, setEnquiries] = useState<CourseEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    return onSnapshot(collection(db, "course_enquiries"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseEnquiry));
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
      setEnquiries(list);
      setLoading(false);
    });
  }, []);

  const updateStatus = async (id: string, status: CourseEnquiry["status"]) => {
    try {
      await updateDoc(doc(db, "course_enquiries", id), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast("success", `Marked as ${status}.`);
    } catch {
      showToast("error", "Failed to update status.");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enquiries.filter((e) => {
      const matchesSearch =
        !q ||
        e.studentName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.courseTitle?.toLowerCase().includes(q) ||
        e.courseId?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enquiries, search, statusFilter]);

  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 10);

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="text-[#6C3CE9]" size={26} /> Course Enquiries
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Enquiries submitted from the student app. Contact students and complete admission manually.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className={inputClass + " pl-10"}
            placeholder="Search by name, email, course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + " sm:w-44"}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Contact</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date & Time</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No enquiries yet.
                  </td>
                </tr>
              ) : (
                paginated.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-medium text-slate-900">{e.studentName || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p>{e.courseTitle || "—"}</p>
                      {e.courseId && <p className="text-xs text-slate-400">{e.courseId}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p>{e.phone || "—"}</p>
                      <p className="text-xs text-slate-400">{e.email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(e.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          STATUS_STYLES[e.status || "pending"] || STATUS_STYLES.pending
                        }`}
                      >
                        {e.status || "pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {e.status !== "contacted" && (
                          <button
                            onClick={() => updateStatus(e.id, "contacted")}
                            className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            Contacted
                          </button>
                        )}
                        {e.status !== "converted" && (
                          <button
                            onClick={() => updateStatus(e.id, "converted")}
                            className="px-2 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          >
                            Converted
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={pageSize} />
      </div>
    </PageTransition>
  );
}
