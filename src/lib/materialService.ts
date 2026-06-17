import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MaterialType, StudyMaterial } from "@/types/erp";

export function subscribeToMaterials(callback: (items: StudyMaterial[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "study_materials"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudyMaterial));
    callback(list);
  });
}

export async function upsertMaterial(
  material: Omit<StudyMaterial, "id" | "createdAt"> & { id?: string }
) {
  const id = material.id || `MAT-${Date.now()}`;
  await setDoc(
    doc(db, "study_materials", id),
    { ...material, createdAt: serverTimestamp() },
    { merge: true }
  );
  return id;
}

export async function deleteMaterial(id: string) {
  await deleteDoc(doc(db, "study_materials", id));
}

export const MATERIAL_TYPES: MaterialType[] = ["pdf", "doc", "ppt", "zip", "image", "video", "link"];
