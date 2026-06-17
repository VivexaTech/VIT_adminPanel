import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApprovalActionType, ApprovalRequest, ApprovalStatus } from "@/types/rbac";
import { deleteDoc, setDoc } from "firebase/firestore";
import { syncStudentFeeMirror } from "@/lib/feeSync";
import type { CustomUser } from "@/context/AuthContext";
import { logAudit } from "@/lib/auditService";

export async function createApprovalRequest(
  user: CustomUser,
  input: {
    actionType: ApprovalActionType;
    targetId?: string;
    targetLabel?: string;
    remarks?: string;
    payload: Record<string, unknown>;
  }
): Promise<string> {
  const ref = await addDoc(collection(db, "approval_requests"), {
    actionType: input.actionType,
    status: "pending" as ApprovalStatus,
    requestedBy: user.email,
    requestedByName: user.fullName || user.email,
    requestedByRole: user.role || "Admin",
    requestDate: new Date().toISOString(),
    remarks: input.remarks || "",
    targetId: input.targetId || null,
    targetLabel: input.targetLabel || null,
    payload: input.payload,
    createdAt: serverTimestamp(),
  });
  await logAudit(user, `approval_requested:${input.actionType}`, {
    resource: input.actionType,
    resourceId: input.targetId,
    details: input.remarks,
  });
  return ref.id;
}

function sortByCreatedAtDesc(items: ApprovalRequest[]): ApprovalRequest[] {
  return [...items].sort((a, b) => {
    const aMs =
      a.createdAt && typeof (a.createdAt as { toMillis?: () => number }).toMillis === "function"
        ? (a.createdAt as { toMillis: () => number }).toMillis()
        : new Date(String(a.requestDate || 0)).getTime();
    const bMs =
      b.createdAt && typeof (b.createdAt as { toMillis?: () => number }).toMillis === "function"
        ? (b.createdAt as { toMillis: () => number }).toMillis()
        : new Date(String(b.requestDate || 0)).getTime();
    return bMs - aMs;
  });
}

export function subscribePendingApprovals(
  callback: (requests: ApprovalRequest[]) => void
): Unsubscribe {
  const q = query(collection(db, "approval_requests"), where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        sortByCreatedAtDesc(
          snap.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              }) as ApprovalRequest
          )
        )
      );
    },
    (error) => {
      console.error("Pending approvals listener error:", error);
      callback([]);
    }
  );
}

export function subscribeAllApprovals(callback: (requests: ApprovalRequest[]) => void): Unsubscribe {
  const q = query(collection(db, "approval_requests"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as ApprovalRequest
        )
      );
    },
    () => callback([])
  );
}

export async function approveRequest(
  requestId: string,
  reviewer: CustomUser,
  reviewRemarks?: string
): Promise<void> {
  const ref = doc(db, "approval_requests", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data() as ApprovalRequest;

  if (data.status !== "pending") throw new Error("Request already processed");

  await executeApprovalAction(data);
  await updateDoc(ref, {
    status: "approved",
    reviewedBy: reviewer.email,
    reviewedByName: reviewer.fullName || reviewer.email,
    reviewedAt: new Date().toISOString(),
    reviewRemarks: reviewRemarks || "",
  });
  await logAudit(reviewer, `approval_approved:${data.actionType}`, {
    resource: data.actionType,
    resourceId: data.targetId,
  });
}

export async function rejectRequest(
  requestId: string,
  reviewer: CustomUser,
  reviewRemarks?: string
): Promise<void> {
  const ref = doc(db, "approval_requests", requestId);
  await updateDoc(ref, {
    status: "rejected",
    reviewedBy: reviewer.email,
    reviewedByName: reviewer.fullName || reviewer.email,
    reviewedAt: new Date().toISOString(),
    reviewRemarks: reviewRemarks || "",
  });
  const snap = await getDoc(ref);
  const data = snap.data() as ApprovalRequest;
  await logAudit(reviewer, `approval_rejected:${data?.actionType}`, {
    resource: data?.actionType,
    resourceId: data?.targetId,
  });
}

async function executeApprovalAction(request: ApprovalRequest): Promise<void> {
  const { actionType, payload, targetId } = request;

  switch (actionType) {
    case "student_delete": {
      const studentId = String(payload.studentId || targetId);
      await deleteDoc(doc(db, "students", studentId));
      break;
    }
    case "fee_modification": {
      const feeId = String(payload.feeId || targetId);
      const feeRef = doc(db, "student_fees", feeId);
      const feeSnap = await getDoc(feeRef);
      if (!feeSnap.exists()) throw new Error("Fee record not found");
      const updates = payload.updates as Record<string, unknown>;
      await updateDoc(feeRef, { ...updates, updatedAt: serverTimestamp() });
      const merged = { ...feeSnap.data(), ...updates };
      await syncStudentFeeMirror({
        studentId: String(merged.studentId || feeId),
        studentName: String(merged.studentName || ""),
        course: String(merged.course || ""),
        totalFee: Number(merged.totalFee) || 0,
        paidAmount: Number(merged.paidAmount) || 0,
        remainingFee: Number(merged.remainingFee) || 0,
        paymentStatus: String(merged.paymentStatus || ""),
        dueDate: String(merged.dueDate || merged.nextDueDate || ""),
        nextDueDate: String(merged.nextDueDate || merged.dueDate || ""),
        installmentType: String(merged.installmentType || ""),
        installments: (merged.installments as Parameters<typeof syncStudentFeeMirror>[0]["installments"]) || [],
      });
      break;
    }
    case "admission_cancel": {
      const admissionId = String(payload.admissionId || targetId);
      await updateDoc(doc(db, "admissions", admissionId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });
      break;
    }
    case "certificate_cancel": {
      const certId = String(payload.certificateId || targetId);
      await deleteDoc(doc(db, "certificates", certId));
      const studentId = String(payload.studentId || "");
      if (studentId) {
        await deleteDoc(doc(db, "students", studentId, "certificates", certId));
      }
      break;
    }
    case "batch_delete": {
      const batchId = String(payload.batchId || targetId);
      await deleteDoc(doc(db, "batches", batchId));
      break;
    }
    case "course_delete": {
      const courseId = String(payload.courseId || targetId);
      await deleteDoc(doc(db, "courses", courseId));
      break;
    }
    default:
      throw new Error(`Unknown action: ${actionType}`);
  }
}

export async function getPendingApprovalCount(): Promise<number> {
  const q = query(collection(db, "approval_requests"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.size;
}

export const ACTION_LABELS: Record<ApprovalActionType, string> = {
  student_delete: "Student Delete",
  fee_modification: "Fee Modification",
  admission_cancel: "Admission Cancellation",
  certificate_cancel: "Certificate Cancellation",
  batch_delete: "Batch Deletion",
  course_delete: "Course Deletion",
};
