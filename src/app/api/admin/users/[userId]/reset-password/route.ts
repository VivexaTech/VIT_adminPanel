import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generateSecurePassword, validatePasswordStrength } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const performer = await verifySuperAdminRequest(request);
    const { userId } = await params;
    const body = await request.json().catch(() => ({}));
    const { password, useGeneratedPassword = true } = body;

    const emailKey = decodeURIComponent(userId).toLowerCase();
    const db = getAdminDb();
    const auth = getAdminAuth();

    const userSnap = await db.collection("users").doc(emailKey).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const userData = userSnap.data()!;
    if (userData.email === performer.email) {
      return NextResponse.json({ error: "Use Change Password to update your own password." }, { status: 400 });
    }

    const uid = userData.uid as string;
    if (!uid) {
      return NextResponse.json({ error: "User has no linked Firebase Auth account." }, { status: 400 });
    }

    let temporaryPassword = "";
    if (useGeneratedPassword) {
      temporaryPassword = generateSecurePassword(12);
    } else {
      temporaryPassword = String(password || "");
      const err = validatePasswordStrength(temporaryPassword);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    await auth.updateUser(uid, { password: temporaryPassword });
    await userSnap.ref.update({
      mustChangePassword: true,
      updatedAt: FieldValue.serverTimestamp(),
      lastPasswordResetBy: performer.email,
      lastPasswordResetAt: FieldValue.serverTimestamp(),
    });

    await logServerAudit(performer, "password_reset", {
      targetEmail: emailKey,
      targetUserId: userData.staffId || emailKey,
      details: `Password reset for ${userData.fullName || emailKey}`,
    });

    return NextResponse.json({
      success: true,
      email: emailKey,
      staffId: userData.staffId,
      temporaryPassword,
      mustChangePassword: true,
      message: "Password reset. User must change password on next login.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password reset failed";
    const status = message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
