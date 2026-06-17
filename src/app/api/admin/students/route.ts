import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const body = await request.json();

    const {
      studentId: providedId,
      fullName,
      parentName,
      email,
      phone,
      password,
      course,
      courseId,
      batch,
      rollNumber,
      status = "Active",
    } = body;

    if (!fullName?.trim() || !email?.trim() || !phone?.trim() || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Name, email, phone, and password (min 6 chars) are required." },
        { status: 400 }
      );
    }
    if (!course?.trim()) {
      return NextResponse.json({ error: "Course enrollment is required." }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();

    let studentId = providedId?.trim().toUpperCase();
    if (!studentId) {
      const counterRef = db.collection("metadata").doc("global_student_counter");
      studentId = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
        tx.set(counterRef, { count }, { merge: true });
        return `ST${String(count).padStart(3, "0")}`;
      });
    }

    const existingDoc = await db.collection("students").doc(studentId).get();
    if (existingDoc.exists) {
      return NextResponse.json({ error: `Student ID ${studentId} already exists.` }, { status: 409 });
    }

    const emailLower = email.trim().toLowerCase();
    const emailQuery = await db.collection("students").where("email", "==", emailLower).limit(1).get();
    if (!emailQuery.empty) {
      return NextResponse.json({ error: "A student with this email already exists." }, { status: 409 });
    }

    const userRecord = await auth.createUser({
      email: emailLower,
      password,
      displayName: fullName.trim(),
      disabled: status === "Inactive" || status === "Suspended",
    });

    const joinDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    await db
      .collection("students")
      .doc(studentId)
      .set({
        uid: userRecord.uid,
        studentId,
        fullName: fullName.trim(),
        parentName: parentName?.trim() || null,
        email: emailLower,
        phone: phone.trim(),
        course: course.trim(),
        courseId: courseId?.trim() || null,
        batch: batch?.trim() || null,
        rollNumber: rollNumber?.trim() || null,
        status,
        role: "student",
        joinDate,
        address: "",
        qualification: "",
        createdAt: FieldValue.serverTimestamp(),
        stats: { enrolled: 1, completed: 0, certificates: 0, pendingFee: "₹0" },
        preferences: { inAppNotifications: true, emailAlerts: false, darkMode: false },
        enrolledCourse: null,
      });

    return NextResponse.json({ success: true, studentId, uid: userRecord.uid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create student";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
