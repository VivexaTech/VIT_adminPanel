"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePermissions } from "@/hooks/usePermissions";
import type { AuditLogEntry } from "@/types/rbac";
import { ScrollText } from "lucide-react";

export default function AuditLogsPage() {
  const { isSuperAdmin } = usePermissions();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as AuditLogEntry
        )
      );
      setLoading(false);
    });
  }, []);

  if (!isSuperAdmin) {
    return (
      <PageTransition>
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500">
          Only Super Admin can view audit logs.
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ScrollText className="text-[#6C3CE9]" size={26} /> Audit Logs
        </h1>
        <p className="text-slate-500 text-sm mt-1">Activity timeline for compliance and security.</p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">When</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {formatTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">{log.userName}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{log.role}</td>
                    <td className="px-5 py-3 text-sm font-medium text-[#6C3CE9]">{log.action}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {log.details || log.resourceId || "—"}
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

function formatTime(ts: unknown): string {
  if (!ts) return "—";
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(String(ts));
  return d.toLocaleString();
}
