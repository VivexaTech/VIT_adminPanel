import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { validatePasswordStrength } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminRequest(request);
    const { newPassword } = await request.json();

    const strengthErr = validatePasswordStrength(String(newPassword || ""));
    if (strengthErr) {
      return NextResponse.json({ error: strengthErr }, { status: 400 });
    }

    const auth = getAdminAuth();
    await auth.updateUser(admin.uid, { password: newPassword });

    const db = getAdminDb();
    const userRef = db.collection("users").doc(admin.email);
    await userRef.update({
      mustChangePassword: false,
      passwordChangedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logServerAudit(admin, "password_changed", {
      targetEmail: admin.email,
      details: "Password changed successfully",
    });

    return NextResponse.json({ success: true, mustChangePassword: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password change failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
