import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  FollowUpEntry,
  Inquiry,
  InquiryDashboardStats,
  InquiryFormInput,
  InquiryStatus,
} from "@/types/inquiry";

export const INQUIRIES_COLLECTION = "institute_inquiries";

function toDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mapInquiry(id: string, data: Record<string, unknown>): Inquiry {
  return {
    id,
    inquiryId: String(data.inquiryId || id),
    fullName: String(data.fullName || ""),
    age: typeof data.age === "number" ? data.age : data.age ? Number(data.age) : null,
    gender: (data.gender as Inquiry["gender"]) || "",
    phone: String(data.phone || ""),
    email: String(data.email || ""),
    educationStatus: String(data.educationStatus || ""),
    occupation: String(data.occupation || ""),
    courseId: String(data.courseId || ""),
    courseTitle: String(data.courseTitle || ""),
    source: String(data.source || ""),
    studentPhotoUrl: String(data.studentPhotoUrl || ""),
    aadhaarUrl: String(data.aadhaarUrl || ""),
    description: String(data.description || ""),
    internalNotes: String(data.internalNotes || ""),
    status: (data.status as InquiryStatus) || "New",
    priority: (data.priority as Inquiry["priority"]) || "Medium",
    nextFollowUpDate: (data.nextFollowUpDate as string) || null,
    lastContactDate: (data.lastContactDate as string) || null,
    followUpCount: Number(data.followUpCount) || 0,
    nextAction: String(data.nextAction || ""),
    followUpHistory: Array.isArray(data.followUpHistory)
      ? (data.followUpHistory as FollowUpEntry[])
      : [],
    createdBy: String(data.createdBy || ""),
    createdByName: String(data.createdByName || ""),
    createdAt: (data.createdAt as Inquiry["createdAt"]) || null,
    updatedAt: (data.updatedAt as Inquiry["updatedAt"]) || null,
    admissionId: (data.admissionId as string) || null,
    convertedAt: (data.convertedAt as string) || null,
  };
}

export async function generateInquiryId(): Promise<string> {
  const year = new Date().getFullYear().toString();
  const counterRef = doc(db, "metadata", `inquiry_counter_${year}`);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const count = (snap.exists() ? snap.data()?.count || 0 : 0) + 1;
    tx.set(counterRef, { count, year: Number(year) }, { merge: true });
    return count;
  });
  return `INQ-${year}-${String(next).padStart(4, "0")}`;
}

function mapAppEnquiry(id: string, data: Record<string, unknown>): Inquiry {
  const statusRaw = String(data.status || "pending").toLowerCase();
  let status: InquiryStatus = "New";
  if (statusRaw === "contacted") status = "Contacted";
  else if (statusRaw === "converted") status = "Admission Confirmed";

  return {
    id: `app_${id}`,
    inquiryId: `APP-${id.slice(0, 8).toUpperCase()}`,
    fullName: String(data.studentName || data.fullName || ""),
    age: null,
    gender: "",
    phone: String(data.phone || ""),
    email: String(data.email || ""),
    educationStatus: "",
    occupation: "",
    courseId: String(data.courseId || ""),
    courseTitle: String(data.courseTitle || ""),
    source: "Online",
    studentPhotoUrl: "",
    aadhaarUrl: "",
    description: String(data.message || data.note || "Submitted from Vivexa Learn app"),
    internalNotes: `Legacy app enquiry id: ${id}`,
    status,
    priority: "Medium",
    nextFollowUpDate: null,
    lastContactDate: null,
    followUpCount: 0,
    nextAction: "",
    followUpHistory: [],
    createdBy: "app",
    createdByName: "Student App",
    createdAt: (data.createdAt as Inquiry["createdAt"]) || null,
    updatedAt: (data.updatedAt as Inquiry["updatedAt"]) || null,
    admissionId: null,
    convertedAt: status === "Admission Confirmed" ? new Date().toISOString() : null,
  };
}

/**
 * Unified inquiry feed: CRM (`institute_inquiries`) + app enquiries (`course_enquiries`).
 * App rows are mapped with source "Online" and prefixed ids so existing CRM edits stay isolated.
 */
export function subscribeToInquiries(
  onData: (items: Inquiry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let crm: Inquiry[] = [];
  let app: Inquiry[] = [];

  const emit = () => {
    const merged = [...crm, ...app];
    merged.sort((a, b) => {
      const ta =
        a.createdAt && typeof a.createdAt === "object" && a.createdAt.toDate
          ? a.createdAt.toDate().getTime()
          : 0;
      const tb =
        b.createdAt && typeof b.createdAt === "object" && b.createdAt.toDate
          ? b.createdAt.toDate().getTime()
          : 0;
      return tb - ta;
    });
    onData(merged);
  };

  const unsubCrm = onSnapshot(
    collection(db, INQUIRIES_COLLECTION),
    (snap) => {
      crm = snap.docs.map((d) => mapInquiry(d.id, d.data() as Record<string, unknown>));
      emit();
    },
    (err) => onError?.(err)
  );

  const unsubApp = onSnapshot(
    collection(db, "course_enquiries"),
    (snap) => {
      app = snap.docs.map((d) => mapAppEnquiry(d.id, d.data() as Record<string, unknown>));
      emit();
    },
    () => {
      // App collection may be empty / permission-limited; still emit CRM data
      app = [];
      emit();
    }
  );

  return () => {
    unsubCrm();
    unsubApp();
  };
}

export async function getInquiryById(id: string): Promise<Inquiry | null> {
  const snap = await getDoc(doc(db, INQUIRIES_COLLECTION, id));
  if (!snap.exists()) return null;
  return mapInquiry(snap.id, snap.data() as Record<string, unknown>);
}

export async function findInquiriesByPhone(phone: string): Promise<Inquiry[]> {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (normalized.length < 10) return [];
  const snap = await getDocs(
    query(collection(db, INQUIRIES_COLLECTION), where("phoneNormalized", "==", normalized))
  );
  return snap.docs.map((d) => mapInquiry(d.id, d.data() as Record<string, unknown>));
}

export async function createInquiry(
  input: InquiryFormInput,
  actor: { uid: string; name: string }
): Promise<{ id: string; inquiryId: string }> {
  const inquiryId = await generateInquiryId();
  const phoneNormalized = input.phone.replace(/\D/g, "").slice(-10);
  const ref = await addDoc(collection(db, INQUIRIES_COLLECTION), {
    inquiryId,
    fullName: input.fullName.trim(),
    age: input.age ?? null,
    gender: input.gender || "",
    phone: input.phone.trim(),
    phoneNormalized,
    email: (input.email || "").trim(),
    educationStatus: input.educationStatus || "",
    occupation: input.occupation || "",
    courseId: input.courseId || "",
    courseTitle: input.courseTitle || "",
    source: input.source || "Offline",
    studentPhotoUrl: input.studentPhotoUrl || "",
    aadhaarUrl: input.aadhaarUrl || "",
    description: input.description || "",
    internalNotes: input.internalNotes || "",
    status: input.status || "New",
    priority: input.priority || "Medium",
    nextFollowUpDate: input.nextFollowUpDate || null,
    lastContactDate: null,
    followUpCount: 0,
    nextAction: input.nextAction || "",
    followUpHistory: [],
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    admissionId: null,
    convertedAt: null,
  });
  return { id: ref.id, inquiryId };
}

export async function updateInquiry(
  id: string,
  input: Partial<InquiryFormInput> & { status?: InquiryStatus; priority?: Inquiry["priority"] }
): Promise<void> {
  const appId = id.startsWith("app_") ? id.slice(4) : null;
  if (appId) {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.fullName !== undefined) payload.studentName = input.fullName;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.email !== undefined) payload.email = input.email;
    if (input.courseId !== undefined) payload.courseId = input.courseId;
    if (input.courseTitle !== undefined) payload.courseTitle = input.courseTitle;
    if (input.status !== undefined) {
      payload.crmStatus = input.status;
      payload.status =
        input.status === "Admission Confirmed"
          ? "converted"
          : input.status === "Contacted" || input.status === "Follow Up" || input.status === "Interested"
            ? "contacted"
            : "pending";
    }
    await updateDoc(doc(db, "course_enquiries", appId), payload);
    return;
  }

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  const fields: (keyof InquiryFormInput)[] = [
    "fullName",
    "age",
    "gender",
    "phone",
    "email",
    "educationStatus",
    "occupation",
    "courseId",
    "courseTitle",
    "source",
    "studentPhotoUrl",
    "aadhaarUrl",
    "description",
    "internalNotes",
    "status",
    "priority",
    "nextFollowUpDate",
    "nextAction",
  ];

  for (const key of fields) {
    if (key in input && input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  if (typeof input.phone === "string") {
    payload.phoneNormalized = input.phone.replace(/\D/g, "").slice(-10);
  }

  await updateDoc(doc(db, INQUIRIES_COLLECTION, id), payload);
}

function appEnquiryRawId(id: string): string | null {
  return id.startsWith("app_") ? id.slice(4) : null;
}

export async function updateInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  const appId = appEnquiryRawId(id);
  if (appId) {
    const appStatus =
      status === "Admission Confirmed"
        ? "converted"
        : status === "Contacted" || status === "Follow Up" || status === "Interested"
          ? "contacted"
          : "pending";
    await updateDoc(doc(db, "course_enquiries", appId), {
      status: appStatus,
      crmStatus: status,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(doc(db, INQUIRIES_COLLECTION, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function addFollowUp(
  inquiryId: string,
  entry: {
    note: string;
    nextFollowUpDate?: string;
    nextAction?: string;
    contactDate?: string;
    status?: InquiryStatus;
  },
  actor: { uid: string; name: string }
): Promise<void> {
  if (inquiryId.startsWith("app_")) {
    const appId = inquiryId.slice(4);
    await updateDoc(doc(db, "course_enquiries", appId), {
      status: "contacted",
      crmStatus: entry.status || "Follow Up",
      lastNote: entry.note.trim(),
      nextFollowUpDate: entry.nextFollowUpDate || null,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const ref = doc(db, INQUIRIES_COLLECTION, inquiryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Inquiry not found");

  const data = snap.data();
  const history: FollowUpEntry[] = Array.isArray(data.followUpHistory) ? [...data.followUpHistory] : [];
  const contactDate = entry.contactDate || toDateKey();
  const newEntry: FollowUpEntry = {
    id: `fu_${Date.now()}`,
    note: entry.note.trim(),
    createdAt: new Date().toISOString(),
    createdBy: actor.uid,
    createdByName: actor.name,
    nextFollowUpDate: entry.nextFollowUpDate || undefined,
    nextAction: entry.nextAction || undefined,
    contactDate,
  };
  history.push(newEntry);

  const payload: Record<string, unknown> = {
    followUpHistory: history,
    followUpCount: history.length,
    lastContactDate: contactDate,
    nextFollowUpDate: entry.nextFollowUpDate || null,
    nextAction: entry.nextAction || data.nextAction || "",
    updatedAt: serverTimestamp(),
  };

  if (entry.status) {
    payload.status = entry.status;
  } else if (data.status === "New") {
    payload.status = "Follow Up";
  }

  await updateDoc(ref, payload);
}

export async function markInquiryAdmissionConfirmed(
  inquiryId: string,
  admissionId: string
): Promise<void> {
  if (inquiryId.startsWith("app_")) {
    await updateDoc(doc(db, "course_enquiries", inquiryId.slice(4)), {
      status: "converted",
      crmStatus: "Admission Confirmed",
      admissionId,
      convertedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(doc(db, INQUIRIES_COLLECTION, inquiryId), {
    status: "Admission Confirmed",
    admissionId,
    convertedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export function getInquiryCreatedDate(inquiry: Inquiry): Date | null {
  if (inquiry.createdAt && typeof inquiry.createdAt === "object" && inquiry.createdAt.toDate) {
    try {
      return inquiry.createdAt.toDate();
    } catch {
      return null;
    }
  }
  if (typeof inquiry.createdAt === "string") {
    const d = new Date(inquiry.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatInquiryDateTime(inquiry: Inquiry): string {
  const d = getInquiryCreatedDate(inquiry);
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatInquiryDate(inquiry: Inquiry): string {
  const d = getInquiryCreatedDate(inquiry);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function isFollowUpOverdue(inquiry: Inquiry, today = toDateKey()): boolean {
  if (!inquiry.nextFollowUpDate) return false;
  if (["Admission Confirmed", "Not Interested", "Cancelled"].includes(inquiry.status)) {
    return false;
  }
  return inquiry.nextFollowUpDate < today;
}

export function isFollowUpToday(inquiry: Inquiry, today = toDateKey()): boolean {
  return inquiry.nextFollowUpDate === today;
}

export function isFollowUpTomorrow(inquiry: Inquiry, today = toDateKey()): boolean {
  return inquiry.nextFollowUpDate === addDays(today, 1);
}

export function computeInquiryStats(inquiries: Inquiry[]): InquiryDashboardStats {
  const today = toDateKey();
  const monthPrefix = today.slice(0, 7);

  let todayCount = 0;
  let thisMonth = 0;
  let pendingFollowUps = 0;
  let todayFollowUps = 0;
  let overdueFollowUps = 0;
  let interested = 0;
  let admissionConfirmed = 0;
  let cancelled = 0;

  for (const i of inquiries) {
    const created = getInquiryCreatedDate(i);
    if (created) {
      const key = created.toISOString().slice(0, 10);
      if (key === today) todayCount += 1;
      if (key.startsWith(monthPrefix)) thisMonth += 1;
    }

    if (i.status === "Interested") interested += 1;
    if (i.status === "Admission Confirmed") admissionConfirmed += 1;
    if (i.status === "Cancelled") cancelled += 1;

    const closed = ["Admission Confirmed", "Not Interested", "Cancelled"].includes(i.status);
    if (!closed && i.nextFollowUpDate) {
      pendingFollowUps += 1;
      if (i.nextFollowUpDate === today) todayFollowUps += 1;
      if (i.nextFollowUpDate < today) overdueFollowUps += 1;
    }
  }

  return {
    total: inquiries.length,
    today: todayCount,
    thisMonth,
    pendingFollowUps,
    todayFollowUps,
    overdueFollowUps,
    interested,
    admissionConfirmed,
    cancelled,
  };
}

export function filterInquiries(
  inquiries: Inquiry[],
  filters: {
    search?: string;
    status?: string;
    priority?: string;
    source?: string;
    course?: string;
    occupation?: string;
    educationStatus?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Inquiry[] {
  const q = (filters.search || "").trim().toLowerCase();
  return inquiries.filter((i) => {
    if (q) {
      const hay = `${i.inquiryId} ${i.fullName} ${i.phone} ${i.email}`.toLowerCase();
      if (!hay.includes(q) && !i.phone.includes(q)) return false;
    }
    if (filters.status && filters.status !== "all" && i.status !== filters.status) return false;
    if (filters.priority && filters.priority !== "all" && i.priority !== filters.priority) return false;
    if (filters.source && filters.source !== "all" && i.source !== filters.source) return false;
    if (filters.course && filters.course !== "all") {
      if (i.courseId !== filters.course && i.courseTitle !== filters.course) return false;
    }
    if (filters.occupation && filters.occupation !== "all" && i.occupation !== filters.occupation) {
      return false;
    }
    if (
      filters.educationStatus &&
      filters.educationStatus !== "all" &&
      i.educationStatus !== filters.educationStatus
    ) {
      return false;
    }
    if (filters.dateFrom || filters.dateTo) {
      const created = getInquiryCreatedDate(i);
      if (!created) return false;
      const key = created.toISOString().slice(0, 10);
      if (filters.dateFrom && key < filters.dateFrom) return false;
      if (filters.dateTo && key > filters.dateTo) return false;
    }
    return true;
  });
}
