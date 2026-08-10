import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { logServerAudit } from "@/lib/serverAudit";

export const runtime = "nodejs";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const performer = await verifyAdminNotTrainerRequest(request);
    const { userId } = await params;
    const { status } = await request.json();

    const emailKey = decodeURIComponent(userId).toLowerCase();
    if (emailKey === performer.email) {
      return NextResponse.json({ error: "You cannot change your own status." }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const ref = db.collection("users").doc(emailKey);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const targetRole = String(snap.data()?.role || "");
    if (performer.role !== "Super Admin" && targetRole === "Super Admin") {
      return NextResponse.json({ error: "Only Super Admin can modify Super Admin accounts." }, { status: 403 });
    }

    const newStatus = status === "active" ? "active" : "suspended";
    await ref.update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });

    const uid = snap.data()?.uid;
    if (uid) {
      await auth.updateUser(uid, { disabled: newStatus !== "active" });
    }

    await logServerAudit(performer, newStatus === "active" ? "user_activated" : "user_deactivated", {
      targetEmail: emailKey,
      details: `Status set to ${newStatus}`,
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const performer = await verifyAdminNotTrainerRequest(request);
    const { userId } = await params;
    const emailKey = decodeURIComponent(userId).toLowerCase();

    if (emailKey === performer.email) {
      return NextResponse.json({ error: "You cannot delete yourself." }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const ref = db.collection("users").doc(emailKey);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const targetRole = String(snap.data()?.role || "");
    if (performer.role !== "Super Admin" && (targetRole === "Super Admin" || performer.role !== "Admin")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (performer.role !== "Super Admin" && targetRole === "Super Admin") {
      return NextResponse.json({ error: "Only Super Admin can delete Super Admin accounts." }, { status: 403 });
    }

    const uid = snap.data()?.uid;
    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch {
        /* auth user may already be removed */
      }
    }

    await ref.delete();
    await logServerAudit(performer, "user_deleted", {
      targetEmail: emailKey,
      details: `Deleted user ${snap.data()?.fullName || emailKey}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
