import { doc, getDocs, query, setDoc, updateDoc, where, serverTimestamp, collection, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CertificateIssueData {
  certificateId: string;
  studentId: string;
  studentName: string;
  course: string;
  courseId?: string;
  issueDate: string;
  issueDateISO?: string;
  duration: string;
  grade: string;
  certificateImage: string;
  certificatePdf?: string;
  verifyUrl: string;
}

export async function studentHasCertificate(studentId: string, courseName?: string): Promise<boolean> {
  const q = query(collection(db, "certificates"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  if (!courseName) return !snap.empty;
  return snap.docs.some((d) => d.data().course === courseName);
}

function parseIssueDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function issueCertificate(data: CertificateIssueData): Promise<void> {
  const issueDate = parseIssueDate(data.issueDateISO || data.issueDate);
  const issueMonth = issueDate.toLocaleString("en-US", { month: "long" });
  const issueYear = String(issueDate.getFullYear());

  const adminRecord = {
    certificateId: data.certificateId,
    studentId: data.studentId,
    studentName: data.studentName,
    course: data.course,
    courseId: data.courseId || null,
    issueDate: data.issueDate,
    duration: data.duration,
    grade: data.grade,
    status: "Verified",
    certificateImage: data.certificateImage,
    certificatePdf: data.certificatePdf || "",
    instituteName: "Vivexa Institute of Technology",
    verifyUrl: data.verifyUrl,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "certificates", data.certificateId), adminRecord);

  const studentCert = {
    id: data.certificateId,
    courseId: data.courseId || "",
    courseName: data.course,
    issueDate: data.issueDate,
    issueMonth,
    issueYear,
    organizationName: "Vivexa Institute of Technology",
    organizationId: "vivexa-institute",
    certificateUrl: data.certificatePdf || data.certificateImage,
    thumbnailUrl: data.certificateImage,
    grade: data.grade,
    verifyUrl: data.verifyUrl,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "students", data.studentId, "certificates", data.certificateId), studentCert);

  const studentRef = doc(db, "students", data.studentId);
  await updateDoc(studentRef, {
    "stats.certificates": increment(1),
    updatedAt: serverTimestamp(),
  });
}
