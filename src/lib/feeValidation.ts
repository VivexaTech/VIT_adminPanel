export type FeeAmounts = {
  totalFee: number;
  discount?: number;
  paidAmount: number;
};

export function getPayableFee(totalFee: number, discount = 0): number {
  return Math.max(0, totalFee - discount);
}

export function validateFeePayment({ totalFee, discount = 0, paidAmount }: FeeAmounts): string | null {
  const payable = getPayableFee(totalFee, discount);
  if (paidAmount < 0) return "Paid amount cannot be negative.";
  if (paidAmount > payable) {
    return `Paid amount (₹${paidAmount.toLocaleString("en-IN")}) cannot exceed payable fee (₹${payable.toLocaleString("en-IN")}).`;
  }
  return null;
}

export function getRemainingFee(totalFee: number, discount: number, paidAmount: number): number {
  return Math.max(0, getPayableFee(totalFee, discount) - paidAmount);
}
