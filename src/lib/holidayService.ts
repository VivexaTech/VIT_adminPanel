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

export type InstituteHoliday = {
  id: string;
  date: string;
  title: string;
  reason?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const HOLIDAYS_COLLECTION = "institute_holidays";

export function subscribeToHolidays(
  callback: (items: InstituteHoliday[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, HOLIDAYS_COLLECTION), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InstituteHoliday));
    list.sort((a, b) => b.date.localeCompare(a.date));
    callback(list);
  });
}

export async function upsertHoliday(
  holiday: Omit<InstituteHoliday, "id" | "createdAt" | "updatedAt"> & { id?: string },
  createdBy?: string
): Promise<string> {
  const id = holiday.id || holiday.date;
  const ref = doc(db, HOLIDAYS_COLLECTION, id);
  await setDoc(
    ref,
    {
      date: holiday.date,
      title: holiday.title.trim(),
      reason: holiday.reason?.trim() || "",
      createdBy: createdBy || "",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export async function deleteHoliday(id: string): Promise<void> {
  await deleteDoc(doc(db, HOLIDAYS_COLLECTION, id));
}
