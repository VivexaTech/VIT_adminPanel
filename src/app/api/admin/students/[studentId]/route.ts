import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Params = { params: Promise<{ studentId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await verifyAdminNotTrainerRequest(request);
    const { studentId } = await params;
    const body = await request.json();
    const db = getAdminDb();
    const auth = getAdminAuth();

    const docRef = db.collection("students").doc(studentId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const data = snap.data()!;
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    const allowed = [
      "fullName",
      "parentName",
      "email",
      "phone",
      "course",
      "courseId",
      "batch",
      "rollNumber",
      "status",
      "address",
      "qualification",
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (body.enrolledCourses !== undefined) {
      updates.enrolledCourses = body.enrolledCourses;
    }

    await docRef.update(updates);

    if (data.uid && (body.disabled !== undefined || body.status !== undefined)) {
      const disabled =
        body.disabled ?? (body.status === "Inactive" || body.status === "Suspended");
      await auth.updateUser(data.uid, { disabled: Boolean(disabled) });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await verifyAdminNotTrainerRequest(request);
    const { studentId } = await params;
    const db = getAdminDb();
    const auth = getAdminAuth();

    const docRef = db.collection("students").doc(studentId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.uid) {
      try {
        await auth.deleteUser(data.uid);
      } catch {
        // Auth user may already be deleted
      }
    }

    await docRef.delete();

    const feeRef = db.collection("student_fees").doc(studentId);
    const feeSnap = await feeRef.get();
    if (feeSnap.exists) await feeRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
