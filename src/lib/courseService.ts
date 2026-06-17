import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateCourseId } from "@/lib/firebaseUtils";
import type { Course, CourseFormValues, CourseStatus } from "@/types/course";
import type { CsvImportResult } from "@/lib/courseCsv";

const COLLECTION = "courses";

function mapDoc(id: string, data: Record<string, unknown>): Course {
  return {
    id,
    courseId: (data.courseId as string) || id,
    ...data,
  } as Course;
}

export function subscribeToCourses(
  onData: (courses: Course[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      onData(list);
    },
    (err) => onError?.(err as Error)
  );
}

export async function isDuplicateCourseTitle(
  title: string,
  excludeCourseId?: string
): Promise<boolean> {
  const titleLower = title.trim().toLowerCase();
  const q = query(collection(db, COLLECTION), where("titleLower", "==", titleLower));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeCourseId && d.data().courseId !== excludeCourseId);
}

function buildCoursePayload(values: CourseFormValues, courseId: string) {
  const priceNum = values.price.trim();
  const discountNum = values.discountPrice.trim();
  const hasDiscount = discountNum.length > 0 && discountNum !== priceNum;

  return {
    courseId,
    title: values.title.trim(),
    titleLower: values.title.trim().toLowerCase(),
    subtitle: values.subtitle.trim() || null,
    description: values.description.trim(),
    category: values.category.trim(),
    imageUrl: values.imageUrl.trim(),
    bannerUrl: values.bannerUrl.trim() || null,
    duration: values.duration.trim(),
    price: hasDiscount ? discountNum : priceNum,
    originalPrice: hasDiscount ? priceNum : null,
    level: values.level,
    instructorName: values.instructorName.trim(),
    instructor: {
      name: values.instructorName.trim(),
      role: "Course Instructor",
      avatar: values.imageUrl.trim() || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
    },
    features: values.features.map((f) => f.trim()).filter(Boolean),
    curriculum: values.curriculum.map((c) => c.trim()).filter(Boolean),
    liveClasses: Number(values.liveClasses) || 0,
    lessons: values.curriculum.filter((c) => c.trim()).length,
    certificate: values.certificate,
    status: values.status,
    featured: values.featured,
  };
}

/** Upsert by courseId (Firestore document ID = courseId) */
export async function upsertCourse(
  values: CourseFormValues,
  options?: { isNew?: boolean }
): Promise<{ courseId: string; created: boolean }> {
  let courseId = values.courseId.trim().toUpperCase();
  if (!courseId) {
    courseId = await generateCourseId();
  }

  const existing = await getDoc(doc(db, COLLECTION, courseId));
  const isNew = options?.isNew ?? !existing.exists();

  if (isNew && (await isDuplicateCourseTitle(values.title))) {
    throw new Error("A course with this title already exists.");
  }
  if (!isNew && (await isDuplicateCourseTitle(values.title, courseId))) {
    throw new Error("A course with this title already exists.");
  }

  const payload = buildCoursePayload({ ...values, courseId }, courseId);
  const ref = doc(db, COLLECTION, courseId);

  if (isNew) {
    await setDoc(ref, {
      ...payload,
      rating: 0,
      reviews: 0,
      students: "0",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { courseId, created: true };
  }

  await setDoc(
    ref,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { courseId, created: false };
}

export async function createCourse(values: CourseFormValues): Promise<string> {
  const { courseId } = await upsertCourse(values, { isNew: true });
  return courseId;
}

export async function updateCourse(
  courseId: string,
  values: CourseFormValues
): Promise<void> {
  await upsertCourse({ ...values, courseId }, { isNew: false });
}

export async function importCoursesFromCsv(
  rows: CourseFormValues[],
  onProgress?: (done: number, total: number) => void
): Promise<CsvImportResult> {
  const result: CsvImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const values of chunk) {
      try {
        const courseId = values.courseId.trim().toUpperCase();
        const existing = await getDoc(doc(db, COLLECTION, courseId));
        const payload = buildCoursePayload(values, courseId);
        const ref = doc(db, COLLECTION, courseId);

        if (existing.exists()) {
          batch.set(
            ref,
            { ...payload, updatedAt: serverTimestamp() },
            { merge: true }
          );
          result.updated += 1;
        } else {
          batch.set(ref, {
            ...payload,
            rating: 0,
            reviews: 0,
            students: "0",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          result.inserted += 1;
        }
      } catch (err) {
        result.skipped += 1;
        result.errors.push({
          row: i + 1,
          courseId: values.courseId,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    await batch.commit();
    onProgress?.(Math.min(i + batchSize, rows.length), rows.length);
  }

  return result;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, courseId));
}

export async function toggleCourseStatus(
  courseId: string,
  currentStatus: CourseStatus
): Promise<CourseStatus> {
  const newStatus: CourseStatus = currentStatus === "active" ? "inactive" : "active";
  await updateDoc(doc(db, COLLECTION, courseId), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
  return newStatus;
}

export function courseToFormValues(course: Course): CourseFormValues {
  const hasDiscount = Boolean(course.originalPrice);
  return {
    courseId: course.courseId || course.id,
    title: course.title,
    subtitle: course.subtitle ?? "",
    description: course.description,
    category: course.category,
    imageUrl: course.imageUrl,
    bannerUrl: course.bannerUrl ?? "",
    duration: course.duration,
    price: hasDiscount ? course.originalPrice ?? course.price : course.price,
    discountPrice: hasDiscount ? course.price : "",
    level: course.level,
    instructorName: course.instructorName ?? course.instructor?.name ?? "",
    features: course.features?.length ? course.features : [""],
    curriculum: course.curriculum?.length ? course.curriculum : [""],
    liveClasses: String(course.liveClasses ?? 0),
    certificate: course.certificate ?? false,
    status: course.status ?? "active",
    featured: course.featured ?? false,
  };
}

export function formatCourseDate(timestamp: Course["createdAt"]): string {
  if (!timestamp) return "—";
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date();
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
