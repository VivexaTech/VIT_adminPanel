import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CustomUser } from "@/context/AuthContext";

export async function logAudit(
  user: CustomUser | null,
  action: string,
  opts?: {
    resource?: string;
    resourceId?: string;
    details?: string;
    ip?: string;
  }
): Promise<void> {
  if (!user?.email) return;

  try {
    await addDoc(collection(db, "audit_logs"), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.fullName || user.email,
      role: user.role || "Admin",
      action,
      resource: opts?.resource || null,
      resourceId: opts?.resourceId || null,
      details: opts?.details || null,
      ip: opts?.ip || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
