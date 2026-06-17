import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDuration, formatFileSize } from "@/lib/cloudinary";
import type { Recording } from "@/types/erp";

const BATCH_WRITE_LIMIT = 450;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function studentRecordingPayload(recording: Recording) {
  return stripUndefined({
    courseId: recording.courseId,
    title: recording.title,
    description: recording.description || "",
    date: recording.uploadDate,
    duration: recording.durationLabel || formatDuration(recording.duration),
    durationSeconds: recording.duration ?? 0,
    topic: recording.topic || "",
    secureVideoUrl: recording.secureVideoUrl,
    thumbnailUrl: recording.thumbnailUrl || "",
    fileSize: recording.fileSize ?? 0,
    batchId: recording.batchId || null,
  });
}

async function syncRecordingToBatchStudents(recording: Recording, recordingId: string) {
  if (!recording.batchId) return;
  const batchSnap = await getDoc(doc(db, "batches", recording.batchId));
  if (!batchSnap.exists()) return;
  const studentIds = (batchSnap.data().studentIds as string[]) ?? [];
  if (studentIds.length === 0) return;

  const payload = studentRecordingPayload(recording);
  for (let i = 0; i < studentIds.length; i += BATCH_WRITE_LIMIT) {
    const chunk = studentIds.slice(i, i + BATCH_WRITE_LIMIT);
    const batch = writeBatch(db);
    for (const studentId of chunk) {
      batch.set(doc(db, "students", studentId, "recordings", recordingId), payload, { merge: true });
    }
    await batch.commit();
  }
}

async function removeRecordingFromBatchStudents(batchId: string, recordingId: string) {
  const batchSnap = await getDoc(doc(db, "batches", batchId));
  if (!batchSnap.exists()) return;
  const studentIds = (batchSnap.data().studentIds as string[]) ?? [];
  if (studentIds.length === 0) return;

  const batch = writeBatch(db);
  for (const studentId of studentIds) {
    batch.delete(doc(db, "students", studentId, "recordings", recordingId));
  }
  await batch.commit();
}

export function subscribeToRecordings(callback: (items: Recording[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "recordings"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Recording));
    list.sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));
    callback(list);
  });
}

export async function upsertRecording(
  recording: Omit<Recording, "id" | "createdAt" | "updatedAt"> & { id?: string },
  options?: { previousBatchId?: string }
) {
  const id = recording.id || `REC-${Date.now()}`;
  const durationLabel = recording.durationLabel || formatDuration(recording.duration);
  const fileSizeLabel = recording.fileSizeLabel || formatFileSize(recording.fileSize);

  const { id: _omitId, ...recordingFields } = recording;
  const docData = stripUndefined({
    ...recordingFields,
    durationLabel,
    fileSizeLabel,
    updatedAt: serverTimestamp(),
    ...(recording.id ? {} : { createdAt: serverTimestamp() }),
  });

  await setDoc(doc(db, "recordings", id), docData, { merge: true });

  if (options?.previousBatchId && options.previousBatchId !== recording.batchId) {
    await removeRecordingFromBatchStudents(options.previousBatchId, id);
  }

  const fullRecording = { ...recording, id, durationLabel, fileSizeLabel } as Recording;
  await syncRecordingToBatchStudents(fullRecording, id);
  return id;
}

export async function deleteRecordingFromFirestore(id: string) {
  const ref = doc(db, "recordings", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Recording;

  if (data.batchId) {
    await removeRecordingFromBatchStudents(data.batchId, id);
  }

  await deleteDoc(ref);
  return data.cloudinaryPublicId;
}
