import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type StudentFeeRecord = {
  studentId: string;
  studentName?: string;
  course?: string;
  totalFee?: number;
  paidAmount?: number;
  remainingFee?: number;
  paymentStatus?: string;
  dueDate?: string;
  nextDueDate?: string;
  installmentType?: string;
  installments?: {
    amount: number;
    method?: string;
    transactionId?: string;
    date: string;
    note?: string;
  }[];
};

function formatPendingFee(remaining: number): string {
  return `₹${Math.max(0, remaining).toLocaleString("en-IN")}`;
}

function mapInstallmentsToTransactions(
  installments: StudentFeeRecord["installments"]
) {
  return (installments || []).map((inst, i) => ({
    id: inst.transactionId || `TXN-${i + 1}`,
    date: typeof inst.date === "string" ? inst.date.split("T")[0] : String(inst.date),
    amount: Number(inst.amount) || 0,
    status: "Paid",
    method: inst.method || "—",
  }));
}

/** Mirror admin `student_fees` doc into student app readable path + stats. */
export async function syncStudentFeeMirror(fee: StudentFeeRecord): Promise<void> {
  const studentId = fee.studentId;
  if (!studentId) return;

  const studentRef = doc(db, "students", studentId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) return;

  const remaining = Number(fee.remainingFee ?? 0);
  const dueDate = fee.nextDueDate || fee.dueDate || "";

  await setDoc(
    doc(db, "students", studentId, "fees", "current"),
    {
      totalFee: Number(fee.totalFee) || 0,
      paidAmount: Number(fee.paidAmount) || 0,
      dueAmount: remaining,
      remainingFee: remaining,
      dueDate,
      nextDueDate: dueDate,
      paymentStatus: fee.paymentStatus || "Pending",
      installmentType: fee.installmentType || "",
      transactions: mapInstallmentsToTransactions(fee.installments),
      syncedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await updateDoc(studentRef, {
    "stats.pendingFee": formatPendingFee(remaining),
    updatedAt: serverTimestamp(),
  });
}

export async function syncStudentFeeMirrorById(studentId: string): Promise<void> {
  const feeSnap = await getDoc(doc(db, "student_fees", studentId));
  if (!feeSnap.exists()) return;
  await syncStudentFeeMirror({ studentId, ...feeSnap.data() } as StudentFeeRecord);
}
