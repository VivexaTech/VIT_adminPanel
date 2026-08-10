import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AttendanceEntry, AttendanceRecord, AttendanceStatus } from "@/types/erp";

export function attendanceRecordId(batchId: string, date: string): string {
  return `${batchId}_${date}`;
}

export function studentAttendanceDocId(batchId: string, date: string): string {
  return `${batchId}_${date}`;
}

export function subscribeToAttendance(
  callback: (records: AttendanceRecord[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "attendance_records"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
    list.sort((a, b) => b.date.localeCompare(a.date));
    callback(list);
  });
}

export async function getAttendanceForBatchDate(
  batchId: string,
  date: string
): Promise<AttendanceRecord | null> {
  const id = attendanceRecordId(batchId, date);
  const snap = await getDoc(doc(db, "attendance_records", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AttendanceRecord;
}

function isPresentStatus(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
}

/**
 * Recalculate a student's attendance totals for a course from all
 * attendance_records (unique by student+date+batch). Holidays are excluded
 * because they never create attendance_records.
 */
async function recalculateStudentAttendance(
  studentId: string,
  courseId: string
): Promise<{ totalClasses: number; completedClasses: number; percentage: number }> {
  const snap = await getDocs(
    query(collection(db, "attendance_records"), where("courseId", "==", courseId))
  );

  let total = 0;
  let completed = 0;

  snap.forEach((d) => {
    const data = d.data() as AttendanceRecord;
    const entry = (data.records || []).find((r) => r.studentId === studentId);
    if (!entry) return;
    total += 1;
    if (isPresentStatus(entry.status)) completed += 1;
  });

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { totalClasses: total, completedClasses: completed, percentage };
}

/**
 * Save attendance for Student + Date + Batch.
 * Doc id `${batchId}_${date}` ensures re-marking updates (never duplicates).
 * Student percentage is recalculated from all records — never double-counted.
 */
export async function saveAttendance(
  batchId: string,
  courseId: string,
  date: string,
  records: AttendanceEntry[],
  markedBy: string,
  meta?: { batchName?: string; courseTitle?: string }
) {
  const id = attendanceRecordId(batchId, date);
  const existingSnap = await getDoc(doc(db, "attendance_records", id));
  const isUpdate = existingSnap.exists();

  await setDoc(
    doc(db, "attendance_records", id),
    {
      batchId,
      courseId,
      batchName: meta?.batchName || existingSnap.data()?.batchName || "",
      courseTitle: meta?.courseTitle || existingSnap.data()?.courseTitle || "",
      date,
      records,
      markedBy,
      updatedAt: serverTimestamp(),
      ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  for (const entry of records) {
    const studentRef = doc(db, "students", entry.studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) continue;

    const data = studentSnap.data();
    const enrolledCourses = Array.isArray(data.enrolledCourses) ? [...data.enrolledCourses] : [];
    const idx = enrolledCourses.findIndex((e: { courseId?: string }) => e.courseId === courseId);

    const { totalClasses, completedClasses, percentage } = await recalculateStudentAttendance(
      entry.studentId,
      courseId
    );

    if (idx >= 0) {
      enrolledCourses[idx] = {
        ...enrolledCourses[idx],
        totalClasses,
        completedClasses,
        attendancePercentage: percentage,
        progress: totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0,
      };
    }

    // Day-level history: unique per student + batch + date
    await setDoc(
      doc(db, "students", entry.studentId, "attendance", studentAttendanceDocId(batchId, date)),
      {
        courseId,
        batchId,
        batchName: meta?.batchName || "",
        courseTitle: meta?.courseTitle || "",
        date,
        status: entry.status,
        percentage,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Monthly rollup for backward-compatible calendar UIs (day-of-month arrays)
    const [year, month] = date.split("-");
    const dayNum = Number(date.slice(8, 10));
    const monthKey = `${courseId}_${year}-${month}`;
    const monthRef = doc(db, "students", entry.studentId, "attendance", monthKey);
    const monthSnap = await getDoc(monthRef);
    const monthData = monthSnap.exists() ? monthSnap.data() : {};
    const present: number[] = Array.isArray(monthData.present) ? [...monthData.present] : [];
    const absent: number[] = Array.isArray(monthData.absent) ? [...monthData.absent] : [];
    const late: number[] = Array.isArray(monthData.late) ? [...monthData.late] : [];

    const stripDay = (arr: number[]) => arr.filter((d) => d !== dayNum);
    let nextPresent = stripDay(present);
    let nextAbsent = stripDay(absent);
    let nextLate = stripDay(late);

    if (entry.status === "present") nextPresent = [...nextPresent, dayNum].sort((a, b) => a - b);
    else if (entry.status === "late") nextLate = [...nextLate, dayNum].sort((a, b) => a - b);
    else nextAbsent = [...nextAbsent, dayNum].sort((a, b) => a - b);

    await setDoc(
      monthRef,
      {
        courseId,
        year: Number(year),
        month: Number(month),
        present: nextPresent,
        absent: nextAbsent,
        late: nextLate,
        upcoming: [],
        percentage,
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
