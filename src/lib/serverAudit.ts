import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

export type ServerAuditAction =
  | "user_created"
  | "password_reset"
  | "password_changed"
  | "user_activated"
  | "user_deactivated"
  | "user_deleted"
  | "student_password_reset"
  | "student_account_created";

export async function logServerAudit(
  performer: { email: string; role: string; fullName?: string; uid?: string },
  action: ServerAuditAction,
  opts?: {
    targetUserId?: string;
    targetEmail?: string;
    details?: string;
    status?: "success" | "failed";
  }
): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection("audit_logs").add({
      userId: performer.uid || performer.email,
      userEmail: performer.email,
      userName: performer.fullName || performer.email,
      role: performer.role,
      action,
      resource: opts?.targetEmail ? "user" : null,
      resourceId: opts?.targetUserId || opts?.targetEmail || null,
      details: opts?.details || null,
      status: opts?.status || "success",
      performedBy: performer.email,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Server audit log failed:", err);
  }
}
