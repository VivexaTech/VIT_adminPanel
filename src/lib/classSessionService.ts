import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Batch, ClassSession, ClassSessionStatus } from "@/types/erp";

export function subscribeToClassSessions(
  callback: (sessions: ClassSession[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "class_sessions"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession));
    list.sort((a, b) => b.date.localeCompare(a.date));
    callback(list);
  });
}

export async function createClassSessionFromBatch(batch: Batch, topic: string, date: string) {
  const id = `${batch.batchId}_${date}`;
  const session: Omit<ClassSession, "id"> = {
    batchId: batch.batchId,
    courseId: batch.courseId,
    courseTitle: batch.courseTitle,
    batchName: batch.name,
    topic,
    trainerName: batch.trainerName,
    date,
    status: "scheduled",
    meetLink: batch.meetLink,
  };
  await setDoc(doc(db, "class_sessions", id), {
    ...session,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function updateClassSessionStatus(
  id: string,
  status: ClassSessionStatus,
  extra?: Partial<ClassSession>
) {
  const payload: Record<string, unknown> = {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  };
  if (status === "live") payload.startedAt = serverTimestamp();
  if (status === "completed") payload.endedAt = serverTimestamp();
  await updateDoc(doc(db, "class_sessions", id), payload);

  const snap = await getDoc(doc(db, "class_sessions", id));
  if (!snap.exists()) return;
  const data = snap.data() as ClassSession;

  const batchSnap = await getDoc(doc(db, "batches", data.batchId));
  if (!batchSnap.exists()) return;
  const batch = batchSnap.data() as Batch;
  const studentIds = batch.studentIds ?? [];

  const batchWrite = writeBatch(db);

  for (const studentId of studentIds) {
    const classRef = doc(db, "students", studentId, "classes", id);
    batchWrite.set(
      classRef,
      {
        courseId: data.courseId,
        batchId: data.batchId,
        title: data.courseTitle,
        topic: data.topic,
        date: data.date,
        time: batch.schedule?.startTime ?? "",
        duration: `${batch.schedule?.startTime} - ${batch.schedule?.endTime}`,
        startTime: buildSessionIso(data.date, batch.schedule?.startTime),
        endTime: buildSessionIso(data.date, batch.schedule?.endTime),
        status: status === "live" ? "live" : status === "completed" ? "completed" : "upcoming",
        meetLink: data.meetLink || batch.meetLink,
        instructor: data.trainerName || batch.trainerName,
        batch: batch.name,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batchWrite.commit();
}

function buildSessionIso(date: string, time?: string): string | undefined {
  if (!date || !time) return undefined;
  const parts = time.match(/^(\d{1,2}):(\d{2})/);
  if (!parts) return undefined;
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  d.setHours(parseInt(parts[1], 10), parseInt(parts[2], 10), 0, 0);
  return d.toISOString();
}
