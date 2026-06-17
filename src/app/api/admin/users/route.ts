import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generateSecurePassword, validatePasswordStrength } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";

async function nextStaffId(role: string): Promise<string> {
  const db = getAdminDb();
  const isTrainer = role === "Trainer" || role === "Teaching Team";
  const counterKey = isTrainer ? "staff_trainer_counter" : "staff_admin_counter";
  const prefix = isTrainer ? "TRN" : "ADM";

  return db.runTransaction(async (tx) => {
    const ref = db.collection("metadata").doc(counterKey);
    const snap = await tx.get(ref);
    const count = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
    tx.set(ref, { count }, { merge: true });
    return `${prefix}-${String(count).padStart(3, "0")}`;
  });
}

export async function POST(request: NextRequest) {
  try {
    const performer = await verifySuperAdminRequest(request);
    const body = await request.json();

    const { fullName, email, role, password, useGeneratedPassword = true, status = "active" } = body;

    const emailLower = String(email || "")
      .trim()
      .toLowerCase();
    if (!fullName?.trim() || !emailLower) {
      return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
    }

    const allowedRoles = ["Admin", "Trainer", "Super Admin"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    let temporaryPassword = "";
    if (useGeneratedPassword) {
      temporaryPassword = generateSecurePassword(12);
    } else {
      temporaryPassword = String(password || "");
      const err = validatePasswordStrength(temporaryPassword);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();

    const existingUser = await db.collection("users").doc(emailLower).get();
    if (existingUser.exists) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }

    let uid: string;
    try {
      const userRecord = await auth.createUser({
        email: emailLower,
        password: temporaryPassword,
        displayName: fullName.trim(),
        disabled: status !== "active",
      });
      uid = userRecord.uid;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        return NextResponse.json({ error: "Firebase account already exists for this email." }, { status: 409 });
      }
      throw err;
    }

    const staffId = await nextStaffId(role);

    await db.collection("users").doc(emailLower).set({
      uid,
      staffId,
      fullName: fullName.trim(),
      email: emailLower,
      role,
      status,
      mustChangePassword: true,
      assignedBatchIds: [],
      createdBy: performer.email,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logServerAudit(performer, "user_created", {
      targetEmail: emailLower,
      targetUserId: staffId,
      details: `${role} account created — ${fullName.trim()}`,
    });

    return NextResponse.json({
      success: true,
      email: emailLower,
      staffId,
      role,
      temporaryPassword,
      mustChangePassword: true,
      message: "User created. Share credentials securely. Password change required on first login.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
