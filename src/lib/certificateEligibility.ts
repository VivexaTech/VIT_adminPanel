import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CertificateEligibility = {
  eligible: boolean;
  reasons: string[];
  feesPaid: boolean;
  courseCompleted: boolean;
  testsCompleted: boolean;
  remainingFee: number;
  pendingTests: string[];
};

export async function checkCertificateEligibility(studentId: string): Promise<CertificateEligibility> {
  const reasons: string[] = [];
  let feesPaid = false;
  let courseCompleted = false;
  let testsCompleted = true;
  let remainingFee = 0;
  const pendingTests: string[] = [];

  const feeSnap = await getDoc(doc(db, "student_fees", studentId));
  if (!feeSnap.exists()) {
    reasons.push("No fee record found for this student.");
  } else {
    const fee = feeSnap.data();
    remainingFee = Number(fee.remainingFee ?? 0);
    feesPaid =
      fee.paymentStatus === "Paid" ||
      (remainingFee <= 0 && Number(fee.paidAmount ?? 0) >= Number(fee.totalFee ?? 0));
    if (!feesPaid) {
      reasons.push("Certificate cannot be issued until all fee payments are completed.");
    }
  }

  const studentSnap = await getDoc(doc(db, "students", studentId));
  if (studentSnap.exists()) {
    const data = studentSnap.data();
    const enrolled = data.enrolledCourse;
    const progress = Number(enrolled?.progress ?? data.progress ?? 0);
    courseCompleted = progress >= 100;
    if (!courseCompleted) {
      reasons.push("Course must be completed (100% progress).");
    }
  } else {
    reasons.push("Student profile not found.");
  }

  const testsSnap = await getDocs(collection(db, "students", studentId, "tests"));
  if (testsSnap.empty) {
    testsCompleted = true;
  } else {
    testsSnap.forEach((d) => {
      const t = d.data();
      if (t.enabled !== false && t.status !== "completed" && t.status !== "disabled") {
        testsCompleted = false;
        pendingTests.push(t.title || d.id);
      }
    });
    if (!testsCompleted) {
      reasons.push(`Pending required tests: ${pendingTests.join(", ")}`);
    }
  }

  const eligible = feesPaid && courseCompleted && testsCompleted;

  return {
    eligible,
    reasons,
    feesPaid,
    courseCompleted,
    testsCompleted,
    remainingFee,
    pendingTests,
  };
}
