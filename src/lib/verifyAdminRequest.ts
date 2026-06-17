import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";

export async function verifyAdminRequest(request: NextRequest) {
  if (!isAdminConfigured()) {
    throw new Error("Server configuration error: Firebase Admin SDK not set up.");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.slice(7);
  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = decoded.email;

  if (!email) throw new Error("Unauthorized");

  const db = getAdminDb();
  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();

  if (usersSnap.empty) throw new Error("Forbidden");
  const userData = usersSnap.docs[0].data();
  if (userData.status !== "active") throw new Error("Forbidden");

  return {
    uid: decoded.uid,
    email,
    role: userData.role as string,
    fullName: userData.fullName as string,
    mustChangePassword: Boolean(userData.mustChangePassword),
  };
}

export async function verifySuperAdminRequest(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (admin.role !== "Super Admin") {
    throw new Error("Forbidden: Super Admin only");
  }
  return admin;
}

export async function verifyAdminNotTrainerRequest(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (admin.role === "Trainer" || admin.role === "Teaching Team") {
    throw new Error("Forbidden: Trainers cannot perform this action");
  }
  return admin;
}
