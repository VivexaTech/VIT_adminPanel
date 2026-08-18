import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function verifyStudentRequest(request: NextRequest) {
  if (!isAdminConfigured()) {
    throw new Error("Server configuration error");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  

  const token = authHeader.slice(7);
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (!decoded.uid) throw new Error("Unauthorized");

  const db = getAdminDb();
  const studentsSnap = await db
    .collection("students")
    .where("uid", "==", decoded.uid)
    .limit(1)
    .get();

  if (studentsSnap.empty) throw new Error("Forbidden");

  const studentDoc = studentsSnap.docs[0];
  return {
    uid: decoded.uid,
    studentId: studentDoc.id,
    studentData: studentDoc.data(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { studentId, studentData } = await verifyStudentRequest(request);
    const body = await request.json();
    const { testDocId, answers } = body;

    if (!testDocId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "testDocId and answers are required." }, { status: 400 });
    }

    const db = getAdminDb();
    const testRef = db.collection("students").doc(studentId).collection("tests").doc(testDocId);
    const testSnap = await testRef.get();
    if (!testSnap.exists) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    const testData = testSnap.data()!;
    if (!testData.enabled || testData.status !== "pending") {
      return NextResponse.json({ error: "Test is not available." }, { status: 403 });
    }

    const questionItems = (testData.questionItems as {
      correctAnswer?: string;
      marks?: number;
    }[]) ?? [];

    let score = 0;
    const maxScore = Number(testData.maxScore) || questionItems.length;
    questionItems.forEach((q, index) => {
      if (answers[index] && answers[index] === q.correctAnswer) {
        score += q.marks ?? 1;
      }
    });

    const passingMarks = Number(testData.passingMarks) || Math.ceil(maxScore * 0.5);
    const passed = score >= passingMarks;
    const now = new Date().toISOString();
    const instituteTestId = String(testData.instituteTestId || testDocId);

    await testRef.update({
      status: "completed",
      score,
      maxScore,
      completedAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db
      .collection("students")
      .doc(studentId)
      .collection("testHistory")
      .doc(`${instituteTestId}_${Date.now()}`)
      .set({
        courseId: testData.courseId || null,
        title: testData.title || "",
        date: now.split("T")[0],
        score,
        maxScore,
        type: testData.type || "weekly",
        passed,
        testId: instituteTestId,
        createdAt: FieldValue.serverTimestamp(),
      });

    await db
      .collection("test_attempts")
      .doc(`${instituteTestId}_${studentId}`)
      .set(
        {
          testId: instituteTestId,
          studentId,
          studentName: String(studentData.fullName || ""),
          title: testData.title || "",
          score,
          maxScore,
          passingMarks,
          passed,
          status: "attempted",
          submittedAt: now,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ score, maxScore, passed, passingMarks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    const status =
      message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
