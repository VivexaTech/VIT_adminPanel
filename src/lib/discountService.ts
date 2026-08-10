import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Discount, DiscountInput } from "@/types/marketing";

const COLLECTION = "discounts";
const now = () => new Date().toISOString();
const clean = (values: DiscountInput) => ({
  name: values.name.trim(),
  code: values.code.trim().toUpperCase(),
  type: values.type,
  value: values.value,
  ...(values.maxDiscount !== undefined ? { maxDiscount: values.maxDiscount } : {}),
  ...(values.minFee !== undefined ? { minFee: values.minFee } : {}),
  ...(values.expiryDate ? { expiryDate: values.expiryDate } : {}),
  ...(values.usageLimit !== undefined ? { usageLimit: values.usageLimit } : {}),
  active: values.active,
  ...(values.description?.trim() ? { description: values.description.trim() } : {}),
});

export function subscribeToDiscounts(onData: (items: Discount[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(collection(db, COLLECTION), (snap) => {
    const items = snap.docs.map((item) => ({ id: item.id, ...item.data() } as Discount));
    items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    onData(items);
  }, (error) => onError?.(error));
}

export async function isDuplicateDiscountCode(code: string, excludeId?: string) {
  const snap = await getDocs(query(collection(db, COLLECTION), where("code", "==", code.trim().toUpperCase())));
  return snap.docs.some((item) => item.id !== excludeId);
}

export async function createDiscount(values: DiscountInput) {
  if (await isDuplicateDiscountCode(values.code)) throw new Error("This discount code already exists.");
  const timestamp = now();
  return (await addDoc(collection(db, COLLECTION), { ...clean(values), usedCount: 0, createdAt: timestamp, updatedAt: timestamp })).id;
}

export async function updateDiscount(id: string, values: DiscountInput) {
  if (await isDuplicateDiscountCode(values.code, id)) throw new Error("This discount code already exists.");
  await updateDoc(doc(db, COLLECTION, id), { ...clean(values), updatedAt: now() });
}

export async function deleteDiscount(id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function toggleDiscountActive(id: string, active: boolean) {
  await updateDoc(doc(db, COLLECTION, id), { active: !active, updatedAt: now() });
}
