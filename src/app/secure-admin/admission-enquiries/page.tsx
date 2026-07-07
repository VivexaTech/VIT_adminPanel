"use client";

import { useEffect, useMemo, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { Search, Trash2, GraduationCap } from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import { inputClass, pageHeader, pageSubtitle, pageTitle } from "@/lib/theme";

type AdmissionEnquiry = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  course?: string;
  message?: string;
  status?: "New" | "Contacted" | "Admitted";
  source?: string;
  createdAt?: { toDate?: () => Date };
};

const STATUS_STYLES: Record<string, string> = {
  New: "bg-amber-100 text-amber-700",
  Contacted: "bg-blue-100 text-blue-700",
  Admitted: "bg-emerald-100 text-emerald-700",
};

function formatDate(ts?: AdmissionEnquiry["createdAt"]): string {
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

export default function AdmissionEnquiriesPage() {
  const { showToast } = useToast();
  const [enquiries, setEnquiries] = useState<AdmissionEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AdmissionEnquiry | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, "admission_enquiries"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdmissionEnquiry));
        list.sort((a, b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return tb - ta;
        });
        setEnquiries(list);
        setLoading(false);
      },
      () => {
        showToast("error", "Failed to load admission enquiries.");
        setLoading(false);
      }
    );
  }, [showToast]);

  const updateStatus = async (id: string, status: AdmissionEnquiry["status"]) => {
    try {
      await updateDoc(doc(db, "admission_enquiries", id), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast("success", `Marked as ${status}.`);
      if (selected?.id === id) setSelected((s) => (s ? { ...s, status } : s));
    } catch {
      showToast("error", "Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this admission enquiry?")) return;
    try {
      await deleteDoc(doc(db, "admission_enquiries", id));
      if (selected?.id === id) setSelected(null);
      showToast("success", "Enquiry deleted.");
    } catch {
      showToast("error", "Failed to delete enquiry.");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enquiries.filter((e) => {
      const matchesSearch =
        !q ||
        e.fullName?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.course?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enquiries, search, statusFilter]);

  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 10);

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Admission Enquiries</h1>
          <p className={pageSubtitle}>
            Website admission form submissions. Mark contacted or admitted when you follow up.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className={inputClass + " pl-10"}
            placeholder="Search by name, email, phone, course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={inputClass + " sm:w-44"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Admitted">Admitted</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="admin-table-scroll">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Applicant</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      No admission enquiries yet.
                    </td>
                  </tr>
                ) : (
                  paginated.map((e) => (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer ${selected?.id === e.id ? "bg-violet-50/50" : ""}`}
                      onClick={() => setSelected(e)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{e.fullName || "—"}</p>
                        <p className="text-xs text-slate-400">{e.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.course || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(e.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[e.status || "New"] || STATUS_STYLES.New}`}
                        >
                          {e.status || "New"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleDelete(e.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} totalItems={filtered.length} />
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5 h-fit">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="text-[#6C3CE9]" size={20} />
                <h2 className="font-semibold text-slate-900">Enquiry Details</h2>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-400">Name</dt>
                  <dd className="font-medium text-slate-900">{selected.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Phone</dt>
                  <dd>
                    <a href={`tel:${selected.phone}`} className="text-[#6C3CE9]">
                      {selected.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Email</dt>
                  <dd>{selected.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Course</dt>
                  <dd className="font-medium">{selected.course}</dd>
                </div>
                {selected.message ? (
                  <div>
                    <dt className="text-slate-400">Message</dt>
                    <dd className="text-slate-600 whitespace-pre-wrap">{selected.message}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-slate-400">Submitted</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 mt-6">
                {selected.status !== "Contacted" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "Contacted")}
                    className="text-sm px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium"
                  >
                    Mark Contacted
                  </button>
                )}
                {selected.status !== "Admitted" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "Admitted")}
                    className="text-sm px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-medium"
                  >
                    Mark Admitted
                  </button>
                )}
                {selected.status !== "New" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "New")}
                    className="text-sm px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-medium"
                  >
                    Mark New
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Select an enquiry to view details.</p>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
