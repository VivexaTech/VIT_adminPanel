import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notice, NoticeInput } from "@/types/marketing";

const COLLECTION = "notices";
const now = () => new Date().toISOString();
const clean = (values: NoticeInput) => ({
  title: values.title.trim(),
  description: values.description.trim(),
  type: values.type,
  color: values.color,
  priority: values.priority,
  ...(values.startDate ? { startDate: values.startDate } : {}),
  ...(values.endDate ? { endDate: values.endDate } : {}),
  active: values.active,
  showInMarquee: values.showInMarquee,
  showAsPopup: values.showAsPopup,
  showOnHomepage: values.showOnHomepage,
  ...(values.link?.trim() ? { link: values.link.trim() } : {}),
});

export function subscribeToNotices(onData: (items: Notice[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(query(collection(db, COLLECTION), orderBy("priority", "desc")), (snap) => {
    onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Notice)));
  }, (error) => onError?.(error));
}

export async function createNotice(values: NoticeInput) {
  const timestamp = now();
  return (await addDoc(collection(db, COLLECTION), { ...clean(values), createdAt: timestamp, updatedAt: timestamp })).id;
}

export async function updateNotice(id: string, values: NoticeInput) {
  await updateDoc(doc(db, COLLECTION, id), { ...clean(values), updatedAt: now() });
}

export async function deleteNotice(id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function toggleNoticeActive(id: string, active: boolean) {
  await updateDoc(doc(db, COLLECTION, id), { active: !active, updatedAt: now() });
}
