export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  iconName?: string;
  order: number;
  active: boolean;
}

/** Default categories seeded into Firestore `categories` collection */
export const DEFAULT_COURSE_CATEGORIES = [
  "Development",
  "Marketing",
  "Accounting",
  "Analytics",
  "Artificial Intelligence",
] as const;

export function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
