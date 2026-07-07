import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/verifyAdminRequest";
import { deleteCloudinaryVideo } from "@/lib/cloudinaryServer";
import { deleteRecordingFromFirestoreAdmin } from "@/lib/recordingAdminService";

export async function POST(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const { recordingId } = await request.json();

    if (!recordingId || typeof recordingId !== "string") {
      return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
    }

    const publicId = await deleteRecordingFromFirestoreAdmin(recordingId);
    if (!publicId) {
      return NextResponse.json({ error: "Recording not found." }, { status: 404 });
    }

    try {
      await deleteCloudinaryVideo(publicId);
    } catch (cloudErr) {
      console.error("Cloudinary delete warning:", cloudErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
