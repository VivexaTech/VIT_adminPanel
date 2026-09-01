import { FieldValue, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { createLiveStream, endLiveStream, getStreamIngestDetails, getStreamStatus, isCloudflareConfigured } from "@/lib/streaming/cloudflare";
import type { AdminIngestDetails, AdminLiveClass, CreateAdminLiveClassInput, LiveClassUiStatus } from "@/types/liveClass";
import type { StreamConnectionState } from "@/lib/streaming/types";

const LIVE_CLASSES = "live_classes";
const SECRETS = "live_class_secrets";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && value && "toDate" in value) return (value as { toDate: () => Date }).toDate();
  if (typeof value === "object" && value && "seconds" in value) return new Date(Number((value as { seconds: number }).seconds) * 1000);
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: unknown): string {
  const date = parseDate(value);
  return date ? date.toISOString() : "";
}

function computeUiStatus(storedStatus: string, startTime: unknown, endTime: unknown, connection: StreamConnectionState): LiveClassUiStatus {
  if (storedStatus === "cancelled") return "cancelled";
  if (storedStatus === "completed") return "completed";
  const now = Date.now();
  const start = parseDate(startTime)?.getTime() ?? 0;
  const end = parseDate(endTime)?.getTime() ?? 0;
  if (start && now < start - 10 * 60 * 1000) return "upcoming";
  if (end && now > end) return "completed";
  if (connection === "connected") return "live";
  return "waiting_for_teacher";
}

function fromDoc(id: string, data: DocumentData, connection: StreamConnectionState = "unknown"): AdminLiveClass {
  const uiStatus = computeUiStatus(String(data.status ?? "upcoming"), data.startTime, data.endTime, connection);
  return {
    id,
    title: String(data.title ?? "Live class"),
    courseId: String(data.courseId ?? ""),
    courseTitle: data.courseTitle ? String(data.courseTitle) : undefined,
    subjectName: data.subjectName ? String(data.subjectName) : undefined,
    teacherId: data.teacherId ? String(data.teacherId) : undefined,
    teacherName: String(data.teacherName ?? data.trainerName ?? "Trainer"),
    batchIds: Array.isArray(data.batchIds) ? data.batchIds.map(String) : data.batchId ? [String(data.batchId)] : [],
    batchName: data.batchName ? String(data.batchName) : undefined,
    allowedStudentIds: Array.isArray(data.allowedStudentIds) ? data.allowedStudentIds.map(String) : [],
    description: data.description ? String(data.description) : undefined,
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
    startTime: toIso(data.startTime),
    endTime: toIso(data.endTime),
    status: uiStatus === "cancelled" ? "cancelled" : uiStatus === "completed" ? "completed" : uiStatus === "upcoming" ? "upcoming" : "live",
    uiStatus,
    recordingEnabled: Boolean(data.recordingEnabled),
    recordingStatus: (data.recordingStatus ?? (data.recordingEnabled ? "processing" : "disabled")) as AdminLiveClass["recordingStatus"],
    playbackMode: data.playbackMode === "legacy" ? "legacy" : "secure",
    createdAt: toIso(data.createdAt),
  };
}

async function connectionFor(streamId?: string): Promise<StreamConnectionState> {
  if (!streamId || !isCloudflareConfigured()) return "unknown";
  try {
    return (await getStreamStatus(streamId)).connection;
  } catch {
    return "unknown";
  }
}

function isTrainerRole(role: string): boolean {
  const value = role.trim().toLowerCase();
  return value === "trainer" || value === "teaching team";
}

function trainerCanSeeClass(
  liveClass: { batchIds: string[]; teacherId?: string },
  createdBy: string | undefined,
  actor: { uid: string; email: string; assignedBatchIds: string[] }
): boolean {
  if (createdBy && (createdBy === actor.uid || createdBy === actor.email)) return true;
  if (liveClass.teacherId && liveClass.teacherId === actor.uid) return true;
  if (!actor.assignedBatchIds.length) return false;
  const assigned = new Set(actor.assignedBatchIds);
  return liveClass.batchIds.some((id) => assigned.has(id));
}

export async function assertTrainerCanManageClass(
  id: string,
  actor: { uid: string; email: string; role: string; assignedBatchIds: string[] }
) {
  if (!isTrainerRole(actor.role)) return;
  const db = getAdminDb();
  const doc = await db.collection(LIVE_CLASSES).doc(id).get();
  if (!doc.exists) throw Object.assign(new Error("Live class not found."), { status: 404 });
  const liveClass = fromDoc(doc.id, doc.data() ?? {});
  if (!trainerCanSeeClass(liveClass, doc.data()?.createdBy ? String(doc.data()?.createdBy) : undefined, actor)) {
    throw Object.assign(new Error("You can only manage live classes for your assigned batches."), { status: 403 });
  }
}

export function assertTrainerCanUseBatches(
  role: string,
  assignedBatchIds: string[],
  batchIds: string[]
) {
  if (!isTrainerRole(role)) return;
  if (!assignedBatchIds.length) {
    throw Object.assign(new Error("No batches are assigned to this trainer account."), { status: 403 });
  }
  const assigned = new Set(assignedBatchIds);
  if (!batchIds.length || !batchIds.some((id) => assigned.has(id))) {
    throw Object.assign(new Error("You can only schedule live classes for your assigned batches."), { status: 403 });
  }
}

export async function listAdminLiveClasses(actor?: {
  uid: string;
  email: string;
  role: string;
  assignedBatchIds: string[];
}): Promise<AdminLiveClass[]> {
  const db = getAdminDb();
  const snap = await db.collection(LIVE_CLASSES).orderBy("startTime", "desc").limit(200).get();
  const classes = await Promise.all(snap.docs.map(async (doc) => {
    const secret = await db.collection(SECRETS).doc(doc.id).get();
    const streamId = secret.exists ? String(secret.data()?.providerStreamId ?? "") : "";
    const uiGuess = computeUiStatus(String(doc.data().status ?? "upcoming"), doc.data().startTime, doc.data().endTime, "unknown");
    const connection = uiGuess === "upcoming" || uiGuess === "completed" || uiGuess === "cancelled"
      ? "unknown"
      : await connectionFor(streamId || undefined);
    return { liveClass: fromDoc(doc.id, doc.data(), connection), createdBy: doc.data().createdBy ? String(doc.data().createdBy) : undefined };
  }));

  if (!actor || !isTrainerRole(actor.role)) {
    return classes.map((item) => item.liveClass);
  }
  return classes
    .filter((item) => trainerCanSeeClass(item.liveClass, item.createdBy, actor))
    .map((item) => item.liveClass);
}

export async function createAdminLiveClass(input: CreateAdminLiveClassInput, createdBy: string) {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw Object.assign(new Error("End time must be after start time."), { status: 400 });
  }
  if (!input.title.trim()) {
    throw Object.assign(new Error("Class title is required."), { status: 400 });
  }
  if (!input.courseId) {
    throw Object.assign(new Error("Select a course."), { status: 400 });
  }
  if (!isCloudflareConfigured()) {
    throw Object.assign(new Error("Cloudflare Stream is not configured on the admin panel. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN."), { status: 503 });
  }

  const db = getAdminDb();
  const ref = db.collection(LIVE_CLASSES).doc();
  const recordingEnabled = input.recordingEnabled !== false;
  const stream = await createLiveStream({ liveClassId: ref.id, title: input.title, recordingEnabled });

  await db.collection(SECRETS).doc(ref.id).set({
    liveClassId: ref.id,
    providerStreamId: stream.streamId,
    playbackId: stream.streamId,
    ingestUrl: stream.ingestUrl,
    streamKey: stream.streamKey,
    srtUrl: stream.srtUrl ?? "",
    srtPassphrase: stream.srtPassphrase ?? "",
    createdAt: FieldValue.serverTimestamp(),
  });

  await ref.set({
    title: input.title.trim(),
    courseId: input.courseId,
    courseTitle: input.courseTitle ?? "",
    subjectName: input.subjectName ?? "",
    teacherId: input.teacherId ?? createdBy,
    teacherName: input.teacherName.trim(),
    trainerName: input.teacherName.trim(),
    batchIds: input.batchIds ?? [],
    batchName: input.batchName ?? "",
    allowedStudentIds: input.allowedStudentIds ?? [],
    description: input.description ?? "",
    thumbnailUrl: input.thumbnailUrl ?? "",
    scheduledDate: Timestamp.fromDate(start),
    startTime: Timestamp.fromDate(start),
    endTime: Timestamp.fromDate(end),
    status: "upcoming",
    playbackMode: "secure",
    streamingProvider: "cloudflare",
    recordingEnabled,
    recordingStatus: recordingEnabled ? "processing" : "disabled",
    recordingId: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy,
  });

  const liveClass = fromDoc(ref.id, (await ref.get()).data() ?? {}, "disconnected");
  const ingest: AdminIngestDetails = {
    ingestUrl: stream.ingestUrl,
    streamKey: stream.streamKey,
    srtUrl: stream.srtUrl,
    srtPassphrase: stream.srtPassphrase,
    instructions: "In OBS: Service = Custom, Server = the RTMPS URL, Stream Key = the private key. Never share this key with students.",
  };
  return { liveClass, ingest };
}

export async function getAdminIngest(id: string): Promise<AdminIngestDetails> {
  const db = getAdminDb();
  const secret = await db.collection(SECRETS).doc(id).get();
  if (!secret.exists) throw Object.assign(new Error("No ingest credentials for this class."), { status: 404 });
  const streamId = String(secret.data()?.providerStreamId ?? "");
  if (!streamId) throw Object.assign(new Error("Stream is not configured."), { status: 400 });
  const details = await getStreamIngestDetails(streamId);
  return {
    ingestUrl: details.ingestUrl,
    streamKey: details.streamKey,
    srtUrl: details.srtUrl,
    srtPassphrase: details.srtPassphrase,
    instructions: "Configure OBS with this RTMPS server and stream key. Students never receive these values.",
  };
}

export async function endAdminLiveClass(id: string) {
  const db = getAdminDb();
  const secret = await db.collection(SECRETS).doc(id).get();
  const streamId = secret.exists ? String(secret.data()?.providerStreamId ?? "") : "";
  if (streamId) await endLiveStream(streamId).catch(() => undefined);
  await db.collection(LIVE_CLASSES).doc(id).update({
    status: "completed",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function cancelAdminLiveClass(id: string) {
  const db = getAdminDb();
  await db.collection(LIVE_CLASSES).doc(id).update({
    status: "cancelled",
    updatedAt: FieldValue.serverTimestamp(),
  });
}
