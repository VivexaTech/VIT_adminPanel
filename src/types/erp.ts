/** Normalized EdTech ERP types — single source of truth for Firestore documents */

export type BatchStatus = "upcoming" | "active" | "completed";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AttendanceStatus = "present" | "absent" | "late";
export type ClassSessionStatus = "scheduled" | "live" | "completed" | "cancelled";
export type AssignmentStatus = "pending" | "submitted" | "reviewed";
export type MaterialType = "pdf" | "doc" | "ppt" | "zip" | "image" | "video" | "link";

export interface BatchSchedule {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface Batch {
  id: string;
  batchId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  trainerId?: string;
  trainerName: string;
  startDate: string;
  endDate: string;
  schedule: BatchSchedule;
  meetLink: string;
  status: BatchStatus;
  studentIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassSession {
  id: string;
  batchId: string;
  courseId: string;
  courseTitle?: string;
  batchName?: string;
  topic: string;
  trainerName?: string;
  date: string;
  status: ClassSessionStatus;
  meetLink?: string;
  recordingUrl?: string;
  notesUrl?: string;
  startedAt?: unknown;
  endedAt?: unknown;
  createdAt?: unknown;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle?: string;
  batchId?: string;
  batchName?: string;
  reason: string;
  leaveDate: string;
  status: LeaveStatus;
  adminNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  courseId: string;
  date: string;
  records: AttendanceEntry[];
  markedBy?: string;
  createdAt?: unknown;
}

export interface AttendanceEntry {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
}

export type RecordingCategory = "general" | "course" | "live_class";

export interface Recording {
  id: string;
  videoId?: string;
  title: string;
  description?: string;
  courseId: string;
  courseTitle?: string;
  batchId?: string;
  batchName?: string;
  topic?: string;
  recordingCategory?: RecordingCategory;
  cloudinaryPublicId: string;
  secureVideoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  durationLabel?: string;
  fileSize: number;
  fileSizeLabel?: string;
  uploadDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  uploadedBy?: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  courseId: string;
  courseTitle?: string;
  batchId?: string;
  type: MaterialType;
  fileUrl: string;
  topicId?: string;
  createdAt?: unknown;
}

export interface CourseTopic {
  id: string;
  title: string;
  order: number;
  videoUrl?: string;
  pdfUrl?: string;
  notesUrl?: string;
  syllabusUrl?: string;
}

export interface Assignment {
  id: string;
  title: string;
  courseId: string;
  batchId?: string;
  description?: string;
  deadline: string;
  maxMarks: number;
  assignedStudentIds: string[];
  createdAt?: unknown;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  fileUrl?: string;
  submittedAt?: unknown;
  marks?: number;
  feedback?: string;
  status: AssignmentStatus;
}

export interface TestAssignment {
  id: string;
  testId: string;
  testTitle: string;
  courseId: string;
  batchId?: string;
  studentIds: string[];
  assignedAt?: unknown;
  dueDate?: string;
}

export interface InstituteSettings {
  instituteName: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  logoUrl?: string;
  updatedAt?: unknown;
}

export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
