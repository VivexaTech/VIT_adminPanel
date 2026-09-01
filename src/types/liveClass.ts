export type LiveClassUiStatus = "upcoming" | "waiting_for_teacher" | "live" | "completed" | "cancelled";
export type LiveRecordingStatus = "disabled" | "processing" | "available" | "failed";

export interface AdminLiveClass {
  id: string;
  title: string;
  courseId: string;
  courseTitle?: string;
  subjectName?: string;
  teacherId?: string;
  teacherName: string;
  batchIds: string[];
  batchName?: string;
  allowedStudentIds: string[];
  description?: string;
  thumbnailUrl?: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "live" | "completed" | "cancelled";
  uiStatus: LiveClassUiStatus;
  recordingEnabled: boolean;
  recordingStatus: LiveRecordingStatus;
  playbackMode: "secure" | "legacy";
  createdAt?: string;
}

export interface CreateAdminLiveClassInput {
  title: string;
  courseId: string;
  courseTitle?: string;
  subjectName?: string;
  teacherId?: string;
  teacherName: string;
  batchIds?: string[];
  batchName?: string;
  allowedStudentIds?: string[];
  description?: string;
  thumbnailUrl?: string;
  startTime: string;
  endTime: string;
  recordingEnabled?: boolean;
}

export interface AdminIngestDetails {
  ingestUrl: string;
  streamKey: string;
  srtUrl?: string;
  srtPassphrase?: string;
  instructions: string;
}
