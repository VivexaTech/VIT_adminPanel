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
import type { Assignment } from "@/types/erp";

export function subscribeToAssignments(callback: (items: Assignment[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "assignments"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
    callback(list);
  });
}

export async function createAssignment(assignment: Omit<Assignment, "id" | "createdAt">) {
  const id = `ASG-${Date.now()}`;
  await setDoc(doc(db, "assignments", id), {
    ...assignment,
    createdAt: serverTimestamp(),
  });

  for (const studentId of assignment.assignedStudentIds) {
    await setDoc(
      doc(db, "students", studentId, "assignments", id),
      {
        assignmentId: id,
        courseId: assignment.courseId,
        title: assignment.title,
        description: assignment.description,
        deadline: assignment.deadline,
        maxMarks: assignment.maxMarks,
        status: "pending",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  return id;
}

export async function deleteAssignment(id: string) {
  await deleteDoc(doc(db, "assignments", id));
}
