import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type StudentNotificationType =
  | "leave_approval"
  | "leave_rejection"
  | "test_assigned"
  | "assignment_assigned"
  | "assignment_reviewed"
  | "study_material"
  | "class_schedule"
  | "certificate"
  | "fee_receipt"
  | "system"
  | "class"
  | "test"
  | "reminder"
  | "course";

type CreateNotificationInput = {
  studentId: string;
  type: StudentNotificationType;
  title: string;
  message: string;
  route?: string;
};

function formatTimeLabel(date = new Date()): string {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function createStudentNotification(input: CreateNotificationInput): Promise<string> {
  const ref = doc(collection(db, "students", input.studentId, "notifications"));
  await setDoc(ref, {
    type: input.type,
    title: input.title,
    message: input.message,
    time: formatTimeLabel(),
    isRead: false,
    route: input.route || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function notifyFeeReceipt(opts: {
  studentId: string;
  receiptNo: string;
  amount: number;
}) {
  return createStudentNotification({
    studentId: opts.studentId,
    type: "fee_receipt",
    title: "Fee Receipt Generated",
    message: `Receipt ${opts.receiptNo} for ₹${opts.amount.toLocaleString("en-IN")} has been issued.`,
    route: "/profile/fee",
  });
}
