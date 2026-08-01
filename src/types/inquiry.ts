export const INQUIRY_STATUSES = [
  "New",
  "Contacted",
  "Follow Up",
  "Interested",
  "Admission Confirmed",
  "Not Interested",
  "Cancelled",
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_PRIORITIES = ["High", "Medium", "Low"] as const;
export type InquiryPriority = (typeof INQUIRY_PRIORITIES)[number];

export const INQUIRY_SOURCES = ["Online", "Offline", "Reference"] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const EDUCATION_OPTIONS = [
  "10th",
  "12th",
  "Graduate",
  "Undergraduate",
  "Diploma",
  "Post Graduate",
  "Other",
] as const;

export const OCCUPATION_OPTIONS = [
  "Student",
  "Working Professional",
  "Business",
  "Job Seeker",
  "Housewife",
  "Other",
] as const;

export const NEXT_ACTION_OPTIONS = [
  "Call",
  "Visit",
  "Demo",
  "Admission Discussion",
  "Documents Pending",
] as const;

export type NextAction = (typeof NEXT_ACTION_OPTIONS)[number];

export type InquiryGender = "Male" | "Female" | "Other";

export type FollowUpEntry = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  nextFollowUpDate?: string;
  nextAction?: string;
  contactDate?: string;
};

export type Inquiry = {
  id: string;
  inquiryId: string;
  fullName: string;
  age?: number | null;
  gender?: InquiryGender | "";
  phone: string;
  email?: string;
  educationStatus?: string;
  occupation?: string;
  courseId?: string;
  courseTitle?: string;
  source?: InquirySource | string;
  studentPhotoUrl?: string;
  aadhaarUrl?: string;
  description?: string;
  internalNotes?: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  nextFollowUpDate?: string | null;
  lastContactDate?: string | null;
  followUpCount: number;
  nextAction?: string;
  followUpHistory: FollowUpEntry[];
  createdBy?: string;
  createdByName?: string;
  createdAt?: { toDate?: () => Date } | string | null;
  updatedAt?: { toDate?: () => Date } | string | null;
  admissionId?: string | null;
  convertedAt?: string | null;
};

export type InquiryFormInput = {
  fullName: string;
  age?: number | null;
  gender?: InquiryGender | "";
  phone: string;
  email?: string;
  educationStatus?: string;
  occupation?: string;
  courseId?: string;
  courseTitle?: string;
  source?: InquirySource | string;
  studentPhotoUrl?: string;
  aadhaarUrl?: string;
  description?: string;
  internalNotes?: string;
  status?: InquiryStatus;
  priority?: InquiryPriority;
  nextFollowUpDate?: string | null;
  nextAction?: string;
};

export const INQUIRY_STATUS_STYLES: Record<InquiryStatus, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-sky-100 text-sky-700",
  "Follow Up": "bg-amber-100 text-amber-800",
  Interested: "bg-violet-100 text-violet-700",
  "Admission Confirmed": "bg-emerald-100 text-emerald-700",
  "Not Interested": "bg-slate-100 text-slate-600",
  Cancelled: "bg-red-100 text-red-700",
};

export const INQUIRY_PRIORITY_STYLES: Record<InquiryPriority, string> = {
  High: "bg-red-50 text-red-700 border border-red-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-slate-50 text-slate-600 border border-slate-200",
};

export type InquiryDashboardStats = {
  total: number;
  today: number;
  thisMonth: number;
  pendingFollowUps: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  interested: number;
  admissionConfirmed: number;
  cancelled: number;
};

export type InquiryChartPoint = { name: string; value: number };
