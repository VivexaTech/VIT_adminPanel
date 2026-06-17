import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generateSecurePassword, validatePasswordStrength } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";

type Params = { params: Promise<{ studentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const performer = await verifyAdminNotTrainerRequest(request);
    const { studentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { password, useGeneratedPassword = false, forcePasswordChange = true } = body;

    let newPassword = String(password || "");
    if (useGeneratedPassword || !newPassword) {
      newPassword = generateSecurePassword(10);
    } else {
      const err = validatePasswordStrength(newPassword);
      if (err && newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const snap = await db.collection("students").doc(studentId).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const uid = snap.data()?.uid;
    if (!uid) {
      return NextResponse.json({ error: "Student has no linked auth account." }, { status: 400 });
    }

    await auth.updateUser(uid, { password: newPassword });
    await snap.ref.update({
      mustChangePassword: Boolean(forcePasswordChange),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logServerAudit(performer, "student_password_reset", {
      targetUserId: studentId,
      targetEmail: snap.data()?.email,
      details: `Password reset for ${snap.data()?.fullName || studentId}`,
    });

    return NextResponse.json({
      success: true,
      temporaryPassword: useGeneratedPassword || !password ? newPassword : undefined,
      mustChangePassword: forcePasswordChange,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
