import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/verifyAdminRequest";
import { isAdminConfigured } from "@/lib/firebaseAdmin";
import { assertTrainerCanManageClass, endAdminLiveClass } from "@/lib/liveClassAdminService";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
    }
    const admin = await verifyAdminRequest(request);
    const { id } = await params;
    await assertTrainerCanManageClass(id, admin);
    await endAdminLiveClass(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end live class";
    const statusFromError = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
    const status =
      statusFromError ||
      (message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500);
    return NextResponse.json({ error: message }, { status });
  }
}
