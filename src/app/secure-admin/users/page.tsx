"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import CredentialsModal from "@/components/admin/CredentialsModal";
import { Search, Plus, Trash2, X, Shield, User as UserIcon, KeyRound, RefreshCw } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { adminApi } from "@/lib/adminApi";
import { generateSecurePassword } from "@/lib/passwordUtils";
import {
  btnPrimaryBlock,
  btnSecondaryBlock,
  inputClass,
  labelClass,
  modalFooter,
  modalOverlay,
  modalPanelSm,
  modalHeader,
  modalBody,
  pageHeader,
  pageHeaderActions,
  pageTitle,
  pageSubtitle,
  selectClass,
} from "@/lib/theme";

type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  staffId?: string;
  mustChangePassword?: boolean;
};

export default function UsersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usersList, setUsersList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useGeneratedPassword, setUseGeneratedPassword] = useState(true);
  const [customPassword, setCustomPassword] = useState("");
  const [previewPassword, setPreviewPassword] = useState("");
  const [credentials, setCredentials] = useState<{ title: string; rows: { label: string; value: string }[] } | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      setUsersList(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StaffUser)));
    } catch {
      const snap = await getDocs(collection(db, "users"));
      setUsersList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffUser)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isSuperAdmin = user?.role === "Super Admin";

  const handleGeneratePreview = () => {
    setPreviewPassword(generateSecurePassword(12));
    setUseGeneratedPassword(true);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await adminApi.createStaffUser({
        fullName: formData.get("fullName") as string,
        email: formData.get("email") as string,
        role: formData.get("role") as string,
        status: formData.get("status") as string,
        useGeneratedPassword,
        password: useGeneratedPassword ? undefined : customPassword,
      });

      setShowModal(false);
      setCustomPassword("");
      setPreviewPassword("");
      fetchUsers();

      setCredentials({
        title: "Staff Account Created",
        rows: [
          { label: "Staff ID", value: result.staffId },
          { label: "Full Name", value: formData.get("fullName") as string },
          { label: "Email", value: result.email },
          { label: "Role", value: result.role },
          { label: "Temporary Password", value: result.temporaryPassword },
        ],
      });
      showToast("success", "User created with Firebase Authentication.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: StaffUser) => {
    if (!isSuperAdmin || u.email === user?.email) return;
    const newStatus = u.status === "active" ? "suspended" : "active";
    if (!window.confirm(`Change ${u.fullName}'s status to ${newStatus}?`)) return;

    try {
      await adminApi.setStaffStatus(u.email, newStatus as "active" | "suspended");
      showToast("success", `User ${newStatus === "active" ? "activated" : "deactivated"}.`);
      fetchUsers();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Status update failed.");
    }
  };

  const handleResetPassword = async (u: StaffUser) => {
    if (!isSuperAdmin || u.email === user?.email) return;
    if (!window.confirm(`Reset password for ${u.fullName}? They must change it on next login.`)) return;

    setResettingEmail(u.email);
    try {
      const result = await adminApi.resetStaffPassword(u.email, { useGeneratedPassword: true });
      setCredentials({
        title: "Password Reset",
        rows: [
          { label: "Staff ID", value: u.staffId || "—" },
          { label: "Email", value: result.email },
          { label: "New Temporary Password", value: result.temporaryPassword },
        ],
      });
      showToast("success", "Password reset. User must change password on next login.");
      fetchUsers();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResettingEmail(null);
    }
  };

  const handleDelete = async (u: StaffUser) => {
    if (!isSuperAdmin || u.email === user?.email) return;
    if (!window.confirm(`Permanently delete ${u.fullName}? This removes Firebase Auth and all access.`)) return;

    try {
      await adminApi.deleteStaffUser(u.email);
      showToast("success", "User deleted.");
      fetchUsers();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.staffId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>User Management</h1>
          <p className={pageSubtitle}>
            Super Admin creates staff accounts with Firebase Authentication. Temporary passwords require change on first login.
          </p>
        </div>
        <div className={pageHeaderActions}>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClass + " pl-10"}
            />
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowModal(true);
                handleGeneratePreview();
              }}
              className={btnPrimaryBlock}
            >
              <Plus size={18} /> Create User
            </button>
          )}
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center gap-2">
          <Shield size={16} />
          Only Super Admin can create, reset, or manage staff accounts.
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Staff ID</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                {isSuperAdmin && (
                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-8 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-full brand-gradient flex items-center justify-center text-white shadow-sm">
                          <UserIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                            <span className="truncate">{u.fullName}</span>
                            {u.email === user?.email && (
                              <span className="text-[10px] bg-[#EDE7FF] text-[#6C3CE9] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                You
                              </span>
                            )}
                            {u.mustChangePassword && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                                Pending password change
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 font-mono text-sm text-[#6C3CE9]">{u.staffId || "—"}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.role === "Super Admin"
                            ? "bg-violet-100 text-violet-700"
                            : u.role === "Trainer" || u.role === "Teaching Team"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.status || "active"}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResetPassword(u)}
                            title="Reset Password"
                            disabled={u.email === user?.email || resettingEmail === u.email}
                            className="p-2 rounded-lg text-slate-400 hover:text-[#6C3CE9] hover:bg-violet-50"
                          >
                            <KeyRound size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === "active" ? "Deactivate" : "Activate"}
                            className={`p-2 rounded-lg ${u.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                            disabled={u.email === user?.email}
                          >
                            <Shield size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            title="Delete User"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                            disabled={u.email === user?.email}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && isSuperAdmin && (
        <div className={modalOverlay}>
          <div className={modalPanelSm}>
            <div className={modalHeader}>
              <div className="min-w-0 pr-2">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Create Staff Account</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Creates Firebase Authentication account + role profile. User must change password on first login.
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 shrink-0 p-1">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className={`${modalBody} space-y-4`}>
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input name="fullName" required placeholder="John Doe" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input name="email" type="email" required placeholder="admin@vivexatech.in" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Role *</label>
                  <select name="role" required className={selectClass} defaultValue="Admin">
                    <option value="Admin">Admin Department</option>
                    <option value="Trainer">Teaching Team (Trainer)</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select name="status" className={selectClass} defaultValue="active">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-800">Temporary Password</p>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={useGeneratedPassword}
                      onChange={() => setUseGeneratedPassword(true)}
                      className="accent-[#6C3CE9]"
                    />
                    Auto-generate secure password (recommended)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={!useGeneratedPassword}
                      onChange={() => setUseGeneratedPassword(false)}
                      className="accent-[#6C3CE9]"
                    />
                    Set custom temporary password
                  </label>
                  {useGeneratedPassword ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={previewPassword}
                        className={inputClass + " font-mono text-sm"}
                        placeholder="Click generate"
                      />
                      <button type="button" onClick={handleGeneratePreview} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      className={inputClass + " font-mono"}
                      placeholder="Min 8 chars, upper, lower, number"
                      minLength={8}
                    />
                  )}
                </div>
              </div>
              <div className={modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} className={btnSecondaryBlock}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className={btnPrimaryBlock}>
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CredentialsModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title || ""}
        subtitle="Share these credentials securely with the user."
        rows={credentials?.rows || []}
        notice="User must change this password on first login before accessing the dashboard."
      />
    </PageTransition>
  );
}
