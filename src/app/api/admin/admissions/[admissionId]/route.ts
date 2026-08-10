import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Params = { params: Promise<{ admissionId: string }> };

/**
 * Update an existing admission record and sync editable student profile fields.
 * Does not recreate Auth users, student IDs, or fee receipts.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Firebase Admin SDK is not configured." }, { status: 503 });
  }

  try {
    await verifyAdminNotTrainerRequest(request);
    const { admissionId } = await params;
    const body = await request.json();
    const db = getAdminDb();

    const admissionRef = db.collection("admissions").doc(admissionId);
    const admissionSnap = await admissionRef.get();
    if (!admissionSnap.exists) {
      return NextResponse.json({ error: "Admission not found." }, { status: 404 });
    }

    const existing = admissionSnap.data() || {};
    const studentId = String(body.studentId || existing.studentId || "");

    const admissionUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    const admissionFields = [
      "fullName",
      "parentName",
      "fatherName",
      "email",
      "phone",
      "qualification",
      "address",
      "city",
      "state",
      "admissionDate",
      "courseDuration",
      "nextDueDate",
      "course",
      "courseId",
      "batch",
      "batchId",
      "notes",
      "studentPhotoUrl",
      "aadhaarUrl",
      "paymentMethod",
    ];

    for (const key of admissionFields) {
      if (body[key] !== undefined) {
        admissionUpdates[key] = body[key];
      }
    }

    // Soft requirements: only enforce if provided as empty when previously required
    if (body.fullName !== undefined && !String(body.fullName).trim()) {
      return NextResponse.json({ error: "Full name cannot be empty." }, { status: 400 });
    }
    if (body.phone !== undefined && !String(body.phone).trim()) {
      return NextResponse.json({ error: "Phone cannot be empty." }, { status: 400 });
    }

    await admissionRef.update(admissionUpdates);

    if (studentId) {
      const studentRef = db.collection("students").doc(studentId);
      const studentSnap = await studentRef.get();
      if (studentSnap.exists) {
        const studentUpdates: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        const studentFields = [
          "fullName",
          "parentName",
          "phone",
          "qualification",
          "address",
          "city",
          "state",
          "studentPhotoUrl",
          "aadhaarUrl",
        ];
        for (const key of studentFields) {
          if (body[key] !== undefined) studentUpdates[key] = body[key];
        }
        if (body.email !== undefined) {
          studentUpdates.personalEmail = String(body.email).trim().toLowerCase();
        }
        if (body.course !== undefined) studentUpdates.course = body.course;
        if (body.batch !== undefined) studentUpdates.batch = body.batch;
        if (body.batchId !== undefined) studentUpdates.batchId = body.batchId;
        await studentRef.update(studentUpdates);
      }
    }

    return NextResponse.json({ success: true, admissionId, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update admission";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
