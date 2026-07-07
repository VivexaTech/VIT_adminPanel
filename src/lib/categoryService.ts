import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CourseCategory } from "@/types/category";
import { DEFAULT_COURSE_CATEGORIES } from "@/types/category";

export function subscribeToCategories(
  callback: (categories: CourseCategory[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, "categories"), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as CourseCategory
      );
      callback(list.filter((c) => c.active !== false));
    },
    (err) => onError?.(err)
  );
}

export function categoryNames(categories: CourseCategory[]): string[] {
  return categories.map((c) => c.name);
}

export { DEFAULT_COURSE_CATEGORIES };
