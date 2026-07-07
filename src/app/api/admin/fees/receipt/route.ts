import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { sendFeeReceiptEmail, isEmailConfigured } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    await verifyAdminNotTrainerRequest(request);
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "Resend API is not configured." }, { status: 503 });
    }
    const body = await request.json();
    const { to, studentName, receiptHtml, receiptNo } = body;
    if (!to || !receiptHtml || !receiptNo) {
      return NextResponse.json({ error: "Missing required receipt fields." }, { status: 400 });
    }
    await sendFeeReceiptEmail({ to, studentName, receiptHtml, receiptNo });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send receipt email";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
