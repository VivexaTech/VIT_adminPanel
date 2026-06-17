import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InstituteTest, TestQuestion, TestQuestionCsvRow } from "@/types/test";
import { csvRowToQuestion, type CsvImportResult } from "@/lib/testCsv";

export async function getTest(testId: string): Promise<InstituteTest | null> {
  const snap = await getDoc(doc(db, "institute_tests", testId));
  if (!snap.exists()) return null;
  return { id: snap.id, testId: snap.id, ...snap.data() } as InstituteTest;
}

export async function saveTest(test: Partial<InstituteTest> & { testId: string }): Promise<void> {
  const id = test.testId.trim();
  const questions = test.questions || [];
  const computedMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);
  const courseId = test.courseId?.trim() || null;
  const subject = test.subject?.trim() || null;

  await setDoc(
    doc(db, "institute_tests", id),
    {
      testId: id,
      title: test.title?.trim(),
      description: test.description?.trim() || "",
      courseId,
      course: test.course?.trim() || courseId,
      batchId: test.batchId?.trim() || null,
      subject,
      totalMarks: test.totalMarks ?? computedMarks,
      passingMarks: test.passingMarks ?? Math.ceil((test.totalMarks ?? computedMarks) * 0.5),
      duration: Number(test.duration) || 30,
      type: test.type || "weekly",
      status: test.status || "active",
      questions,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (questions.length) {
    const bankBatch = writeBatch(db);
    for (const q of questions) {
      bankBatch.set(
        doc(db, "question_bank", q.id),
        {
          questionId: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          marks: q.marks ?? 1,
          subject,
          courseId,
          usedInTests: arrayUnion(id),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await bankBatch.commit();
  }
}

export async function updateTestQuestions(testId: string, questions: TestQuestion[]): Promise<void> {
  const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);
  await updateDoc(doc(db, "institute_tests", testId), {
    questions,
    totalMarks,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTest(testId: string): Promise<void> {
  await deleteDoc(doc(db, "institute_tests", testId));
}

function mergeQuestionsIntoTest(
  existing: TestQuestion[],
  incoming: TestQuestion[]
): { questions: TestQuestion[]; inserted: number; updated: number } {
  const byId = new Map<string, TestQuestion>();
  const order: string[] = [];

  for (const q of existing) {
    byId.set(q.id, q);
    order.push(q.id);
  }

  let inserted = 0;
  let updated = 0;

  for (const q of incoming) {
    if (byId.has(q.id)) {
      byId.set(q.id, q);
      updated += 1;
    } else {
      byId.set(q.id, q);
      order.push(q.id);
      inserted += 1;
    }
  }

  const questions = order.map((id) => byId.get(id)!);
  return { questions, inserted, updated };
}

export async function importQuestionsFromCsv(
  rows: TestQuestionCsvRow[],
  onProgress?: (done: number, total: number) => void
): Promise<CsvImportResult> {
  const result: CsvImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    testsCreated: 0,
    testsUpdated: 0,
    bankUpserted: 0,
    errors: [],
  };

  const grouped = new Map<string, { testTitle: string; questions: TestQuestion[] }>();

  for (const row of rows) {
    const testId = row.testId.trim();
    const converted = csvRowToQuestion(row);
    if ("error" in converted) {
      result.skipped += 1;
      continue;
    }

    const group = grouped.get(testId) ?? { testTitle: row.testTitle.trim(), questions: [] };
    group.testTitle = row.testTitle.trim() || group.testTitle;

    const duplicateInBatch = group.questions.find((q) => q.id === converted.question.id);
    if (duplicateInBatch) {
      Object.assign(duplicateInBatch, converted.question);
    } else {
      group.questions.push(converted.question);
    }

    grouped.set(testId, group);
  }

  const testIds = Array.from(grouped.keys());
  let processed = 0;

  for (const testId of testIds) {
    const { testTitle, questions: incomingQuestions } = grouped.get(testId)!;

    try {
      const ref = doc(db, "institute_tests", testId);
      const existingSnap = await getDoc(ref);
      const existingData = existingSnap.exists() ? (existingSnap.data() as InstituteTest) : null;
      const existingQuestions = existingData?.questions ?? [];

      const { questions, inserted, updated } = mergeQuestionsIntoTest(existingQuestions, incomingQuestions);
      const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);

      await setDoc(
        ref,
        {
          testId,
          title: testTitle || existingData?.title || testId,
          questions,
          totalMarks,
          passingMarks: existingData?.passingMarks ?? Math.ceil(totalMarks * 0.5),
          duration: existingData?.duration ?? 30,
          type: existingData?.type ?? "weekly",
          status: existingData?.status ?? "active",
          updatedAt: serverTimestamp(),
          ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      result.inserted += inserted;
      result.updated += updated;
      if (existingSnap.exists()) result.testsUpdated += 1;
      else result.testsCreated += 1;

      const bankBatch = writeBatch(db);
      for (const q of incomingQuestions) {
        const bankRef = doc(db, "question_bank", q.id);
        bankBatch.set(
          bankRef,
          {
            questionId: q.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            marks: q.marks ?? 1,
            subject: existingData?.subject ?? null,
            courseId: existingData?.courseId ?? existingData?.course ?? null,
            usedInTests: arrayUnion(testId),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        result.bankUpserted += 1;
      }
      await bankBatch.commit();
    } catch (err) {
      result.errors.push({
        row: 0,
        testId,
        message: err instanceof Error ? err.message : "Import failed for test",
      });
      result.skipped += incomingQuestions.length;
    }

    processed += 1;
    onProgress?.(processed, testIds.length);
  }

  return result;
}

/** @deprecated Use importQuestionsFromCsv */
export async function importTestsFromCsv(
  rows: TestQuestionCsvRow[],
  onProgress?: (done: number, total: number) => void
): Promise<CsvImportResult> {
  return importQuestionsFromCsv(rows, onProgress);
}
