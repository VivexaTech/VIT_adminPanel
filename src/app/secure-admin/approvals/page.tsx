"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ACTION_LABELS,
  approveRequest,
  rejectRequest,
  subscribeAllApprovals,
} from "@/lib/approvalService";
import type { ApprovalRequest } from "@/types/rbac";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/theme";
import { ShieldCheck, Check, X, Clock } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return subscribeAllApprovals(setRequests);
  }, []);

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleApprove = async (id: string) => {
    if (!user || !isSuperAdmin) return;
    setProcessing(true);
    try {
      await approveRequest(id, user, remarks);
      showToast("success", "Request approved and action executed.");
      setReviewId(null);
      setRemarks("");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!user || !isSuperAdmin) return;
    setProcessing(true);
    try {
      await rejectRequest(id, user, remarks);
      showToast("success", "Request rejected.");
      setReviewId(null);
      setRemarks("");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setProcessing(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <PageTransition>
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500">
          Only Super Admin can manage approval requests.
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="text-[#6C3CE9]" size={26} /> Approval Requests
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review sensitive actions submitted by Admin users. {pendingCount} pending.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
              filter === f ? "bg-[#6C3CE9] text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-slate-400">No requests found.</div>
        ) : (
          filtered.map((req) => (
            <div key={req.id} className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {ACTION_LABELS[req.actionType] || req.actionType}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Target: <span className="font-medium">{req.targetLabel || req.targetId || "—"}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Requested by {req.requestedByName} ({req.requestedByRole}) ·{" "}
                    {new Date(req.requestDate).toLocaleString()}
                  </p>
                  {req.remarks && (
                    <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">{req.remarks}</p>
                  )}
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReviewId(req.id)}
                      className={btnSecondary + " text-sm"}
                    >
                      Review
                    </button>
                  </div>
                )}
              </div>
              {req.status !== "pending" && req.reviewedByName && (
                <p className="text-xs text-slate-400">
                  {req.status === "approved" ? "Approved" : "Rejected"} by {req.reviewedByName} ·{" "}
                  {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ""}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-slate-900">Review Request</h3>
            <div>
              <label className={labelClass}>Remarks (optional)</label>
              <textarea className={inputClass} rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => handleApprove(reviewId)}
                className={btnPrimary + " flex-1 justify-center bg-emerald-600 hover:bg-emerald-700"}
              >
                <Check size={16} /> Approve
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleReject(reviewId)}
                className="flex-1 justify-center px-5 py-2.5 rounded-xl bg-red-500 text-white font-medium flex items-center gap-2"
              >
                <X size={16} /> Reject
              </button>
              <button type="button" onClick={() => setReviewId(null)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "pending"
      ? "bg-amber-100 text-amber-800"
      : status === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {status === "pending" && <Clock size={12} />}
      {status === "pending" ? "Pending Approval" : status}
    </span>
  );
}
