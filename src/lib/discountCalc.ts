import type { Discount } from "@/types/marketing";

export type AppliedDiscountItem = {
  id: string;
  code: string;
  name: string;
  type: "percentage" | "flat";
  value: number;
  amountApplied: number;
};

export function amountFromDiscount(totalFee: number, discount: Discount): number {
  if (!discount.active) return 0;
  if (discount.minFee && totalFee < discount.minFee) return 0;
  if (discount.expiryDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (discount.expiryDate < today) return 0;
  }
  if (
    typeof discount.usageLimit === "number" &&
    discount.usageLimit > 0 &&
    discount.usedCount >= discount.usageLimit
  ) {
    return 0;
  }

  if (discount.type === "flat") {
    return Math.min(Math.max(0, discount.value), totalFee);
  }

  let pct = (totalFee * Math.max(0, Math.min(100, discount.value))) / 100;
  if (typeof discount.maxDiscount === "number" && discount.maxDiscount > 0) {
    pct = Math.min(pct, discount.maxDiscount);
  }
  return Math.min(pct, totalFee);
}

export function computeStackedDiscount(
  totalFee: number,
  discounts: Discount[],
  manualAmount = 0
): { totalDiscount: number; breakdown: AppliedDiscountItem[]; manualAmount: number } {
  let remaining = Math.max(0, totalFee);
  const breakdown: AppliedDiscountItem[] = [];

  for (const d of discounts) {
    const applied = Math.min(amountFromDiscount(remaining, d), remaining);
    if (applied <= 0) continue;
    breakdown.push({
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      value: d.value,
      amountApplied: Math.round(applied),
    });
    remaining -= applied;
  }

  const manual = Math.min(Math.max(0, Number(manualAmount) || 0), remaining);
  remaining -= manual;

  const totalDiscount = Math.max(0, totalFee - remaining);
  return {
    totalDiscount: Math.round(totalDiscount),
    breakdown,
    manualAmount: Math.round(manual),
  };
}

export function buildUpiPaymentUrl(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName.trim() || "Institute",
    am: opts.amount.toFixed(2),
    cu: "INR",
  });
  if (opts.note?.trim()) params.set("tn", opts.note.trim().slice(0, 80));
  return `upi://pay?${params.toString()}`;
}
