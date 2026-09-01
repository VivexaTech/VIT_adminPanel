import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/verifyAdminRequest";
import { isAdminConfigured } from "@/lib/firebaseAdmin";
import {
  assertTrainerCanUseBatches,
  createAdminLiveClass,
  listAdminLiveClasses,
} from "@/lib/liveClassAdminService";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const statusFromError = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: number }).status)
    : undefined;
  const status =
    statusFromError ||
    (message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
    }
    const admin = await verifyAdminRequest(request);
    const liveClasses = await listAdminLiveClasses({
      uid: admin.uid,
      email: admin.email,
      role: admin.role,
      assignedBatchIds: admin.assignedBatchIds,
    });
    return NextResponse.json({ liveClasses });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
    }
    const admin = await verifyAdminRequest(request);
    const body = await request.json();
    const batchIds = Array.isArray(body.batchIds) ? body.batchIds.map(String).filter(Boolean) : [];
    assertTrainerCanUseBatches(admin.role, admin.assignedBatchIds, batchIds);

    const title = String(body.title ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const teacherName = String(body.teacherName ?? admin.fullName ?? "Trainer").trim();
    const startTime = String(body.startTime ?? "");
    const endTime = String(body.endTime ?? "");

    if (!title || !courseId || !startTime || !endTime) {
      return NextResponse.json({ error: "Title, course, start time, and end time are required." }, { status: 400 });
    }

    const result = await createAdminLiveClass(
      {
        title,
        courseId,
        courseTitle: body.courseTitle ? String(body.courseTitle) : undefined,
        subjectName: body.subjectName ? String(body.subjectName) : undefined,
        teacherId: admin.uid,
        teacherName,
        batchIds,
        batchName: body.batchName ? String(body.batchName) : undefined,
        allowedStudentIds: Array.isArray(body.allowedStudentIds) ? body.allowedStudentIds.map(String) : [],
        description: body.description ? String(body.description) : undefined,
        thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl) : undefined,
        startTime,
        endTime,
        recordingEnabled: body.recordingEnabled !== false,
        youtubeUrl: body.youtubeUrl ? String(body.youtubeUrl) : undefined,
      },
      admin.email
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
