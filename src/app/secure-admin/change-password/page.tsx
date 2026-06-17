"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/admin/PageTransition";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/lib/adminApi";
import { btnPrimary, inputClass, labelClass } from "@/lib/theme";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { validatePasswordStrength } from "@/lib/passwordUtils";

export default function ChangePasswordPage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const strengthErr = validatePasswordStrength(newPassword);
    if (strengthErr) {
      setError(strengthErr);
      return;
    }

    setLoading(true);
    try {
      await adminApi.changePassword(newPassword);
      await refreshProfile();
      router.replace("/secure-admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="glass-card p-6 sm:p-8 rounded-2xl shadow-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl brand-gradient flex items-center justify-center">
              <Lock className="text-white" size={26} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Set New Password</h1>
            <p className="text-sm text-slate-500 mt-2">
              {user?.mustChangePassword
                ? "For security, you must change your temporary password before accessing the dashboard."
                : "Update your account password."}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex gap-2">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={inputClass + " pr-12"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-slate-400">
              Min 8 characters with uppercase, lowercase, and a number.
            </p>
            <button type="submit" disabled={loading} className={btnPrimary + " w-full py-3 justify-center"}>
              {loading ? "Updating..." : "Update Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
