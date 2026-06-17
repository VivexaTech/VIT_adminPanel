import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { QuestionBankEntry, TestQuestion } from "@/types/test";

const COLLECTION = "question_bank";

export async function getAllQuestionBankEntries(): Promise<QuestionBankEntry[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(
    (d) =>
      ({
        id: d.id,
        questionId: d.data().questionId || d.id,
        ...d.data(),
      }) as QuestionBankEntry
  );
}

export async function getQuestionBankEntry(questionId: string): Promise<QuestionBankEntry | null> {
  const snap = await getDoc(doc(db, COLLECTION, questionId));
  if (!snap.exists()) return null;
  return { id: snap.id, questionId: snap.id, ...snap.data() } as QuestionBankEntry;
}

export function questionToBankEntry(
  question: TestQuestion,
  testId: string,
  meta?: { subject?: string; courseId?: string }
): Omit<QuestionBankEntry, "createdAt" | "updatedAt"> {
  return {
    id: question.id,
    questionId: question.id,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    marks: question.marks ?? 1,
    subject: meta?.subject,
    courseId: meta?.courseId,
    usedInTests: [testId],
  };
}

export async function upsertQuestionBankEntry(
  question: TestQuestion,
  testId: string,
  meta?: { subject?: string; courseId?: string }
): Promise<void> {
  const ref = doc(db, COLLECTION, question.id);
  const existing = await getDoc(ref);
  const prevTests = existing.exists() ? (existing.data().usedInTests as string[] | undefined) ?? [] : [];
  const usedInTests = Array.from(new Set([...prevTests, testId]));

  await setDoc(
    ref,
    {
      questionId: question.id,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      marks: question.marks ?? 1,
      subject: meta?.subject ?? existing.data()?.subject ?? null,
      courseId: meta?.courseId ?? existing.data()?.courseId ?? null,
      usedInTests,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function batchUpsertQuestionBank(
  items: { question: TestQuestion; testId: string; subject?: string; courseId?: string }[]
): Promise<number> {
  if (!items.length) return 0;

  let upserted = 0;
  const chunkSize = 400;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const ref = doc(db, COLLECTION, item.question.id);
      const existing = await getDoc(ref);
      const prevTests = existing.exists()
        ? ((existing.data().usedInTests as string[] | undefined) ?? [])
        : [];
      const usedInTests = Array.from(new Set([...prevTests, item.testId]));

      batch.set(
        ref,
        {
          questionId: item.question.id,
          question: item.question.question,
          options: item.question.options,
          correctAnswer: item.question.correctAnswer,
          marks: item.question.marks ?? 1,
          subject: item.subject ?? existing.data()?.subject ?? null,
          courseId: item.courseId ?? existing.data()?.courseId ?? null,
          usedInTests,
          updatedAt: serverTimestamp(),
          ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      upserted += 1;
    }

    await batch.commit();
  }

  return upserted;
}

export async function deleteQuestionBankEntry(questionId: string): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, COLLECTION, questionId));
}
