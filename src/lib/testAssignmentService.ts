import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InstituteTest, TestAssignType } from "@/types/test";

export type AssignTestInput = {
  testId: string;
  assignType: TestAssignType;
  studentIds?: string[];
  batchIds?: string[];
  courseIds?: string[];
  dueDate?: string;
};

async function resolveStudentIds(input: AssignTestInput): Promise<string[]> {
  const ids = new Set<string>(input.studentIds || []);

  if (input.assignType === "batch" || input.batchIds?.length) {
    for (const batchId of input.batchIds || []) {
      const batchSnap = await getDoc(doc(db, "batches", batchId));
      if (batchSnap.exists()) {
        const list: string[] = batchSnap.data().studentIds || [];
        list.forEach((id) => ids.add(id));
      }
    }
  }

  if (input.assignType === "course" || input.courseIds?.length) {
    for (const courseId of input.courseIds || []) {
      const studentsSnap = await getDocs(
        query(collection(db, "students"), where("courseId", "==", courseId))
      );
      studentsSnap.forEach((d) => ids.add(d.id));
      const enrolledSnap = await getDocs(collection(db, "students"));
      enrolledSnap.forEach((d) => {
        const data = d.data();
        const courses = data.enrolledCourses as { courseId?: string }[] | undefined;
        if (courses?.some((c) => c.courseId === courseId)) ids.add(d.id);
        if (data.courseId === courseId) ids.add(d.id);
      });
    }
  }

  return Array.from(ids).filter(Boolean);
}

function buildStudentTestPayload(test: InstituteTest, dueDate?: string) {
  const questions = test.questions || [];
  const totalMarks =
    test.totalMarks ??
    questions.reduce((sum, q) => sum + (q.marks ?? 1), 0);

  return {
    title: test.title,
    courseId: test.courseId || test.course || null,
    type: test.type || "weekly",
    dueDate: dueDate || "",
    questions: questions.length,
    questionItems: questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    })),
    duration: test.duration || 30,
    timeLimitInSeconds: (test.duration || 30) * 60,
    maxScore: totalMarks,
    passingMarks: test.passingMarks ?? Math.ceil(totalMarks * 0.5),
    status: "pending",
    enabled: true,
    assigned: true,
    instituteTestId: test.testId || test.id,
    updatedAt: serverTimestamp(),
  };
}

export async function assignTestToStudents(input: AssignTestInput): Promise<{
  assignedCount: number;
  studentIds: string[];
}> {
  const testRef = doc(db, "institute_tests", input.testId);
  const testSnap = await getDoc(testRef);
  if (!testSnap.exists()) throw new Error("Test not found.");
  const test = { id: testSnap.id, testId: testSnap.id, ...testSnap.data() } as InstituteTest;

  if (!test.questions?.length) {
    throw new Error("Add questions to this test before assigning.");
  }

  const studentIds = await resolveStudentIds(input);
  if (!studentIds.length) throw new Error("No students matched this assignment.");

  const batch = writeBatch(db);
  const payload = buildStudentTestPayload(test, input.dueDate);

  studentIds.forEach((studentId) => {
    batch.set(doc(db, "students", studentId, "tests", input.testId), payload, { merge: true });
    batch.set(
      doc(db, "test_attempts", `${input.testId}_${studentId}`),
      {
        testId: input.testId,
        studentId,
        title: test.title,
        maxScore: payload.maxScore,
        passingMarks: payload.passingMarks,
        score: 0,
        passed: false,
        status: "pending",
      },
      { merge: true }
    );
  });

  const assignmentId = `${input.testId}_${Date.now()}`;
  batch.set(doc(db, "test_assignments", assignmentId), {
    testId: input.testId,
    title: test.title,
    courseId: test.courseId || null,
    batchId: test.batchId || null,
    assignType: input.assignType,
    studentIds,
    batchIds: input.batchIds || [],
    courseIds: input.courseIds || [],
    dueDate: input.dueDate || "",
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return { assignedCount: studentIds.length, studentIds };
}

export function subscribeToTestAttempts(
  testId: string,
  cb: (attempts: import("@/types/test").TestAttemptRecord[]) => void
) {
  return onSnapshot(query(collection(db, "test_attempts"), where("testId", "==", testId)), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as import("@/types/test").TestAttemptRecord[]
    );
  });
}
