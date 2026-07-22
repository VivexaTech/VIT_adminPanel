import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Banner, BannerInput } from "@/types/marketing";

const COLLECTION = "banners";
const now = () => new Date().toISOString();
const clean = (values: BannerInput) => ({
  imageUrl: values.imageUrl.trim(),
  ...(values.title?.trim() ? { title: values.title.trim() } : {}),
  ...(values.subtitle?.trim() ? { subtitle: values.subtitle.trim() } : {}),
  ...(values.buttonText?.trim() ? { buttonText: values.buttonText.trim() } : {}),
  ...(values.buttonLink?.trim() ? { buttonLink: values.buttonLink.trim() } : {}),
  order: values.order,
  active: values.active,
});

export function subscribeToBanners(onData: (items: Banner[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(query(collection(db, COLLECTION), orderBy("order", "asc")), (snap) => {
    onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Banner)));
  }, (error) => onError?.(error));
}

export async function getNextBannerOrder() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.reduce((max, item) => Math.max(max, Number(item.data().order) || 0), 0) + 1;
}

export async function createBanner(values: BannerInput) {
  const timestamp = now();
  return (await addDoc(collection(db, COLLECTION), { ...clean(values), createdAt: timestamp, updatedAt: timestamp })).id;
}

export async function updateBanner(id: string, values: BannerInput) {
  await updateDoc(doc(db, COLLECTION, id), { ...clean(values), updatedAt: now() });
}

export async function deleteBanner(id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function toggleBannerActive(id: string, active: boolean) {
  await updateDoc(doc(db, COLLECTION, id), { active: !active, updatedAt: now() });
}

export async function moveBanner(id: string, direction: "up" | "down") {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("order", "asc")));
  const items = snap.docs.map((item) => ({ id: item.id, order: Number(item.data().order) || 0 }));
  const index = items.findIndex((item) => item.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= items.length) return;
  const current = items[index];
  const swap = items[swapIndex];
  const timestamp = now();
  await runTransaction(db, async (transaction) => {
    transaction.update(doc(db, COLLECTION, current.id), { order: swap.order, updatedAt: timestamp });
    transaction.update(doc(db, COLLECTION, swap.id), { order: current.order, updatedAt: timestamp });
  });
}
