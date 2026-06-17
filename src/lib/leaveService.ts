import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LeaveRequest, LeaveStatus } from "@/types/erp";

export function subscribeToLeaveRequests(
  callback: (items: LeaveRequest[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "leave_requests"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
    list.sort((a, b) => {
      const ta = (a.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const tb = (b.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
    callback(list);
  });
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveStatus,
  adminNote?: string
) {
  await updateDoc(doc(db, "leave_requests", id), {
    status,
    adminNote: adminNote || null,
    updatedAt: serverTimestamp(),
  });
}
