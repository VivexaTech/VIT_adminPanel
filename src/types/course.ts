import type { Timestamp } from "firebase/firestore";

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
export type CourseStatus = "active" | "inactive";

export interface Course {
  id: string;
  courseId: string;
  title: string;
  titleLower: string;
  subtitle?: string;
  description: string;
  category: string;
  imageUrl: string;
  bannerUrl?: string;
  duration: string;
  price: string;
  originalPrice?: string;
  level: CourseLevel;
  instructorName: string;
  instructor?: {
    name: string;
    role: string;
    avatar: string;
    experience?: string;
  };
  features: string[];
  curriculum: string[];
  liveClasses: number;
  certificate: boolean;
  status: CourseStatus;
  featured?: boolean;
  rating?: number;
  reviews?: number;
  students?: string;
  lessons?: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type CourseFormValues = {
  courseId: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  imageUrl: string;
  bannerUrl: string;
  duration: string;
  price: string;
  discountPrice: string;
  level: CourseLevel;
  instructorName: string;
  features: string[];
  curriculum: string[];
  liveClasses: string;
  certificate: boolean;
  status: CourseStatus;
  featured: boolean;
};

export const COURSE_LEVELS: CourseLevel[] = ["Beginner", "Intermediate", "Advanced"];

export const COURSE_CATEGORIES = [
  "Web Development",
  "Data Science",
  "Mobile Development",
  "AI/ML",
  "Design",
  "Cloud Computing",
  "Cybersecurity",
  "Other",
];

export const CSV_HEADERS = [
  "courseId",
  "title",
  "subtitle",
  "description",
  "category",
  "imageUrl",
  "bannerUrl",
  "duration",
  "price",
  "discountPrice",
  "level",
  "instructorName",
  "features",
  "curriculum",
  "liveClasses",
  "certificate",
  "status",
  "featured",
] as const;

export const EMPTY_COURSE_FORM: CourseFormValues = {
  courseId: "",
  title: "",
  subtitle: "",
  description: "",
  category: "",
  imageUrl: "",
  bannerUrl: "",
  duration: "",
  price: "",
  discountPrice: "",
  level: "Beginner",
  instructorName: "",
  features: [""],
  curriculum: [""],
  liveClasses: "0",
  certificate: true,
  status: "active",
  featured: false,
};
