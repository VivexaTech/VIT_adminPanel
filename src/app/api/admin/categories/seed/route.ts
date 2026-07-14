import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";
import { DEFAULT_COURSE_CATEGORIES, slugifyCategory } from "@/types/category";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { error: "Firebase Admin SDK is not configured on the server." },
        { status: 503 }
      );
    }

    await verifyAdminNotTrainerRequest(request);
    const db = getAdminDb();
    const col = db.collection("categories");
    const existing = await col.get();
    const existingNames = new Set(
      existing.docs.map((d) => String(d.data().name || "").toLowerCase())
    );

    let created = 0;
    const batch = db.batch();

    DEFAULT_COURSE_CATEGORIES.forEach((name, index) => {
      if (existingNames.has(name.toLowerCase())) return;
      const slug = slugifyCategory(name);
      const iconMap: Record<string, string> = {
        Development: "code",
        Marketing: "megaphone",
        Accounting: "calculator",
        Analytics: "chart",
        "Artificial Intelligence": "brain",
      };
      const ref = col.doc(slug);
      batch.set(ref, {
        name,
        slug,
        iconName: iconMap[name] || "book",
        order: index + 1,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      created += 1;
    });

    if (created > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      created,
      message:
        created > 0
          ? `Created ${created} categor${created === 1 ? "y" : "ies"}.`
          : "All default categories already exist.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to seed categories";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
