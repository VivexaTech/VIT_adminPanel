import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { slugifyCategory } from "@/types/category";

export async function GET(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin not configured." }, { status: 503 });
    }
    await verifyAdminNotTrainerRequest(request);
    const snap = await getAdminDb().collection("categories").orderBy("order", "asc").get();
    const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch categories";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin not configured." }, { status: 503 });
    }
    await verifyAdminNotTrainerRequest(request);
    const body = await request.json();
    const { name, iconName, order, active = true } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }
    const slug = slugifyCategory(name);
    const db = getAdminDb();
    const ref = db.collection("categories").doc(slug);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ error: "Category already exists." }, { status: 409 });
    }
    await ref.set({
      name: name.trim(),
      slug,
      iconName: iconName || "book",
      order: Number(order) || 99,
      active: active !== false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, id: slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create category";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin not configured." }, { status: 503 });
    }
    await verifyAdminNotTrainerRequest(request);
    const body = await request.json();
    const { id, name, iconName, order, active } = body;
    if (!id) return NextResponse.json({ error: "Category id required." }, { status: 400 });
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = String(name).trim();
    if (iconName !== undefined) updates.iconName = String(iconName);
    if (order !== undefined) updates.order = Number(order);
    if (active !== undefined) updates.active = Boolean(active);
    await getAdminDb().collection("categories").doc(id).update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update category";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin not configured." }, { status: 503 });
    }
    await verifyAdminNotTrainerRequest(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Category id required." }, { status: 400 });
    await getAdminDb().collection("categories").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete category";
    const status = message.includes("Forbidden") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
