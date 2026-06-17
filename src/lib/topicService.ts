import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CourseTopic } from "@/types/erp";

export function subscribeToCourseTopics(
  courseId: string,
  callback: (topics: CourseTopic[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "courses", courseId, "topics"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseTopic));
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(list);
  });
}

export async function upsertTopic(courseId: string, topic: CourseTopic) {
  const id = topic.id || `TOP-${Date.now()}`;
  await setDoc(
    doc(db, "courses", courseId, "topics", id),
    { ...topic, id, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return id;
}

export async function deleteTopic(courseId: string, topicId: string) {
  await deleteDoc(doc(db, "courses", courseId, "topics", topicId));
}
