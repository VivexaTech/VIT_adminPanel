import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type QuestionItem = {
  id?: string;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  answer?: string;
  correctOption?: string;
  correctAnswerIndex?: number;
  answerIndex?: number;
  marks?: number;
  points?: number;
};

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------
    // 1. Verify Firebase user
    // -----------------------------------------
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // -----------------------------------------
    // 2. Read request body
    // -----------------------------------------
    const body = await request.json();

    const testDocId = String(body?.testDocId ?? "").trim();
    const answers = Array.isArray(body?.answers)
      ? body.answers
      : [];

    if (!testDocId) {
      return NextResponse.json(
        { error: "testDocId is required" },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. Firebase Admin DB
    // -----------------------------------------
    const db = getAdminDb();

    // -----------------------------------------
    // 4. Get the original test
    // -----------------------------------------
    const testRef = db.collection("institute_tests").doc(testDocId);
    const testSnap = await testRef.get();

    if (!testSnap.exists) {
      return NextResponse.json(
        { error: "Test not found" },
        { status: 404 }
      );
    }

    const testData = testSnap.data() ?? {};

    // -----------------------------------------
    // 5. Get questions
    // -----------------------------------------
    const questionItems: QuestionItem[] = Array.isArray(
      testData.questionItems
    )
      ? testData.questionItems
      : Array.isArray(testData.questions)
        ? testData.questions
        : [];

    if (!questionItems.length) {
      return NextResponse.json(
        { error: "This test has no questions" },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 6. Check if student has this test assigned
    // -----------------------------------------
    const studentRef = db.collection("students").doc(uid);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const assignedRef = studentRef
      .collection("tests")
      .doc(testDocId);

    const assignedSnap = await assignedRef.get();

    // Some existing assignments may use a different document ID,
    // so also check instituteTestId if the direct document isn't found.
    let assignedData: Record<string, unknown> | null =
      assignedSnap.exists
        ? (assignedSnap.data() as Record<string, unknown>)
        : null;

    if (!assignedData) {
      const assignedQuery = await studentRef
        .collection("tests")
        .where("instituteTestId", "==", testDocId)
        .limit(1)
        .get();

      if (!assignedQuery.empty) {
        assignedData =
          assignedQuery.docs[0].data() as Record<string, unknown>;
      }
    }

    if (
      assignedData &&
      assignedData.enabled === false
    ) {
      return NextResponse.json(
        { error: "This test is disabled" },
        { status: 403 }
      );
    }

    if (
      assignedData &&
      assignedData.status &&
      assignedData.status !== "pending"
    ) {
      return NextResponse.json(
        { error: "This test has already been submitted" },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 7. Prevent duplicate submissions
    // -----------------------------------------
    const historyQuery = await studentRef
      .collection("testHistory")
      .where("testId", "==", testDocId)
      .limit(1)
      .get();

    if (!historyQuery.empty) {
      return NextResponse.json(
        { error: "This test has already been submitted" },
        { status: 409 }
      );
    }

    // -----------------------------------------
    // 8. Calculate score
    // -----------------------------------------
    let score = 0;
    let maxScore = 0;

    const questionResults = questionItems.map(
      (question, index) => {
        const marks = Number(
          question.marks ??
            question.points ??
            testData.marksPerQuestion ??
            1
        );

        maxScore += marks;

        const submittedAnswer =
          answers[index] == null
            ? null
            : String(answers[index]);

        let correctAnswer: string | null = null;

        if (
          typeof question.correctAnswer === "string"
        ) {
          correctAnswer = question.correctAnswer;
        } else if (
          typeof question.answer === "string"
        ) {
          correctAnswer = question.answer;
        } else if (
          typeof question.correctOption === "string"
        ) {
          correctAnswer = question.correctOption;
        } else if (
          typeof question.correctAnswerIndex === "number"
        ) {
          correctAnswer =
            question.options?.[
              question.correctAnswerIndex
            ] ?? null;
        } else if (
          typeof question.answerIndex === "number"
        ) {
          correctAnswer =
            question.options?.[
              question.answerIndex
            ] ?? null;
        }

        const isCorrect =
          submittedAnswer !== null &&
          correctAnswer !== null &&
          submittedAnswer.trim() === correctAnswer.trim();

        if (isCorrect) {
          score += marks;
        }

        return {
          questionId: question.id ?? String(index),
          selectedAnswer: submittedAnswer,
          correct: isCorrect,
          marks: isCorrect ? marks : 0,
        };
      }
    );

    // -----------------------------------------
    // 9. Passing marks
    // -----------------------------------------
    const configuredPassingMarks = Number(
      assignedData?.passingMarks ??
        testData.passingMarks ??
        testData.passMarks ??
        0
    );

    const passingMarks =
      configuredPassingMarks > 0
        ? configuredPassingMarks
        : Math.ceil(maxScore * 0.4);

    const passed = score >= passingMarks;

    // -----------------------------------------
    // 10. Save result
    // -----------------------------------------
    const historyRef = studentRef
      .collection("testHistory")
      .doc();

    const now = new Date();

    await historyRef.set({
      id: historyRef.id,

      testId: testDocId,
      instituteTestId: testDocId,

      title: String(
        assignedData?.title ??
          testData.title ??
          "Test"
      ),

      type: String(
        assignedData?.type ??
          testData.type ??
          "test"
      ),

      score,
      maxScore,
      passingMarks,
      passed,

      totalQuestions: questionItems.length,

      attemptedQuestions: answers.filter(
        (answer: unknown) =>
          answer !== null &&
          answer !== undefined &&
          String(answer).trim() !== ""
      ).length,

      questionResults,

      submittedAt: now,

      // Useful for result/history screens
      percentage:
        maxScore > 0
          ? Math.round((score / maxScore) * 100)
          : 0,
    });

    // -----------------------------------------
    // 11. Mark assigned test as completed
    // -----------------------------------------
    if (assignedSnap.exists) {
      await assignedRef.update({
        status: "completed",
        enabled: false,
        score,
        maxScore,
        passingMarks,
        passed,
        submittedAt: now,
        completedAt: now,
      });
    } else if (assignedData) {
      const assignedQuery = await studentRef
        .collection("tests")
        .where("instituteTestId", "==", testDocId)
        .limit(1)
        .get();

      if (!assignedQuery.empty) {
        await assignedQuery.docs[0].ref.update({
          status: "completed",
          enabled: false,
          score,
          maxScore,
          passingMarks,
          passed,
          submittedAt: now,
          completedAt: now,
        });
      }
    }

    // -----------------------------------------
    // 12. Return result to frontend
    // -----------------------------------------
    return NextResponse.json({
      score,
      maxScore,
      passed,
      passingMarks,
    });
  } catch (error) {
    console.error("GRADE TEST API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to grade test",
      },
      { status: 500 }
    );
  }
}