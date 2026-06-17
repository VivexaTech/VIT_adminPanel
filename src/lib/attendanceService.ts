import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceEntry, AttendanceRecord, AttendanceStatus } from "@/types/erp";

export function subscribeToAttendance(
  callback: (records: AttendanceRecord[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "attendance_records"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
    list.sort((a, b) => b.date.localeCompare(a.date));
    callback(list);
  });
}

export async function saveAttendance(
  batchId: string,
  courseId: string,
  date: string,
  records: AttendanceEntry[],
  markedBy: string
) {
  const id = `${batchId}_${date}`;
  await setDoc(doc(db, "attendance_records", id), {
    batchId,
    courseId,
    date,
    records,
    markedBy,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  for (const entry of records) {
    const studentRef = doc(db, "students", entry.studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) continue;

    const data = studentSnap.data();
    const enrolledCourses = Array.isArray(data.enrolledCourses) ? [...data.enrolledCourses] : [];
    const idx = enrolledCourses.findIndex((e: { courseId?: string }) => e.courseId === courseId);
    if (idx >= 0) {
      const course = enrolledCourses[idx];
      const total = (course.totalClasses ?? 0) + 1;
      const completed =
        entry.status === "present" || entry.status === "late"
          ? (course.completedClasses ?? 0) + 1
          : course.completedClasses ?? 0;
      enrolledCourses[idx] = {
        ...course,
        totalClasses: total,
        completedClasses: completed,
        attendancePercentage: Math.round((completed / total) * 100),
      };
    }

    await setDoc(
      doc(db, "students", entry.studentId, "attendance", courseId),
      {
        courseId,
        batchId,
        date,
        status: entry.status,
        percentage: enrolledCourses[idx]?.attendancePercentage ?? 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (idx >= 0) {
      await setDoc(
        studentRef,
        {
          enrolledCourses,
          enrolledCourse: enrolledCourses[0] ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
}

export function defaultAttendanceStatus(): AttendanceStatus {
  return "present";
}
