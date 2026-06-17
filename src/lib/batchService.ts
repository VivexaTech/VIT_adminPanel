import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Batch, BatchStatus } from "@/types/erp";

function sortBatches(list: Batch[]): Batch[] {
  return [...list].sort((a, b) => {
    const aTime = (a.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const bTime = (b.updatedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

export function subscribeToBatches(
  callback: (batches: Batch[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "batches"),
    (snap) => {
      const list = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            batchId: d.data().batchId || d.id,
            ...d.data(),
          }) as Batch
      );
      callback(sortBatches(list));
    },
    (err) => onError?.(err)
  );
}

async function syncStudentsToBatch(
  batchId: string,
  batchName: string,
  courseId: string,
  courseTitle: string,
  studentIds: string[],
  previousStudentIds: string[] = []
): Promise<void> {
  const allAffected = Array.from(new Set([...studentIds, ...previousStudentIds]));
  if (!allAffected.length) return;

  const chunkSize = 400;
  for (let i = 0; i < allAffected.length; i += chunkSize) {
    const chunk = allAffected.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const studentId of chunk) {
      const isAssigned = studentIds.includes(studentId);
      const studentRef = doc(db, "students", studentId);
      const snap = await getDoc(studentRef);
      if (!snap.exists()) continue;

      const data = snap.data();
      const enrolled = data.enrolledCourse || {};
      const enrolledCourses = Array.isArray(data.enrolledCourses) ? [...data.enrolledCourses] : [];

      if (isAssigned) {
        const updatedEnrollment = {
          ...enrolled,
          courseId: courseId || enrolled.courseId,
          title: courseTitle || enrolled.title,
          batch: batchName,
          batchId,
        };
        const idx = enrolledCourses.findIndex((e: { courseId?: string }) => e.courseId === courseId);
        if (idx >= 0) {
          enrolledCourses[idx] = { ...enrolledCourses[idx], batch: batchName, batchId };
        }
        batch.update(studentRef, {
          batch: batchName,
          batchId,
          enrolledCourse: updatedEnrollment,
          enrolledCourses: enrolledCourses.length ? enrolledCourses : [updatedEnrollment],
          updatedAt: serverTimestamp(),
        });
      } else if (data.batchId === batchId) {
        const cleared = { ...enrolled, batch: null, batchId: null };
        batch.update(studentRef, {
          batch: null,
          batchId: null,
          enrolledCourse: cleared,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  }
}

export async function upsertBatch(
  batch: Omit<Batch, "id" | "createdAt" | "updatedAt"> & { id?: string },
  options?: { isNew?: boolean }
) {
  const id = batch.id || batch.batchId || `BAT-${Date.now()}`;
  const ref = doc(db, "batches", id);

  let previousStudentIds: string[] = [];
  if (!options?.isNew) {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      previousStudentIds = (existing.data().studentIds as string[]) || [];
    }
  }

  const isNew = options?.isNew ?? !(await getDoc(ref)).exists();

  await setDoc(
    ref,
    {
      ...batch,
      batchId: id,
      id,
      studentIds: batch.studentIds ?? [],
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true }
  );

  await syncStudentsToBatch(
    id,
    batch.name,
    batch.courseId,
    batch.courseTitle,
    batch.studentIds ?? [],
    previousStudentIds
  );

  return id;
}

export async function updateBatchStatus(id: string, status: BatchStatus) {
  await updateDoc(doc(db, "batches", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteBatch(id: string) {
  const snap = await getDoc(doc(db, "batches", id));
  const studentIds = (snap.data()?.studentIds as string[]) || [];
  await deleteDoc(doc(db, "batches", id));
  if (snap.exists()) {
    const data = snap.data() as Batch;
    await syncStudentsToBatch(id, data.name, data.courseId, data.courseTitle, [], studentIds);
  }
}

export async function assignStudentsToBatch(batchId: string, studentIds: string[]) {
  const snap = await getDoc(doc(db, "batches", batchId));
  if (!snap.exists()) throw new Error("Batch not found");
  const data = snap.data() as Batch;
  const previous = data.studentIds || [];
  await updateDoc(doc(db, "batches", batchId), {
    studentIds,
    updatedAt: serverTimestamp(),
  });
  await syncStudentsToBatch(batchId, data.name, data.courseId, data.courseTitle, studentIds, previous);
}

export function filterBatchesForTrainer(batches: Batch[], assignedBatchIds?: string[]): Batch[] {
  if (!assignedBatchIds?.length) return [];
  const set = new Set(assignedBatchIds);
  return batches.filter((b) => set.has(b.id) || set.has(b.batchId));
}
