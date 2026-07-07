import { getAdminDb } from "@/lib/firebaseAdmin";
import type { Firestore } from "firebase-admin/firestore";
import type { Recording } from "@/types/erp";

const BATCH_WRITE_LIMIT = 450;

async function removeRecordingFromBatchStudents(
  db: Firestore,
  batchId: string,
  recordingId: string
) {
  const batchSnap = await db.collection("batches").doc(batchId).get();
  if (!batchSnap.exists) return;
  const studentIds = (batchSnap.data()?.studentIds as string[]) ?? [];
  if (studentIds.length === 0) return;

  for (let i = 0; i < studentIds.length; i += BATCH_WRITE_LIMIT) {
    const chunk = studentIds.slice(i, i + BATCH_WRITE_LIMIT);
    const batch = db.batch();
    for (const studentId of chunk) {
      batch.delete(
        db.collection("students").doc(studentId).collection("recordings").doc(recordingId)
      );
    }
    await batch.commit();
  }
}

export async function deleteRecordingFromFirestoreAdmin(id: string): Promise<string | null> {
  const db = getAdminDb();
  const ref = db.collection("recordings").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as Recording;
  if (data.batchId) {
    await removeRecordingFromBatchStudents(db, data.batchId, id);
  }

  await ref.delete();
  return data.cloudinaryPublicId ?? null;
}
