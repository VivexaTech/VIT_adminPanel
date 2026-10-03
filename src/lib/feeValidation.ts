export type FeeAmounts = {
  totalFee: number;
  discount?: number;
  paidAmount: number;
};

/** Fields stored on `student_fees` documents. */
export type FeeRecordAmounts = {
  totalFee?: number;
  originalFee?: number;
  discount?: number;
  paidAmount?: number;
  remainingFee?: number;
};

export function getPayableFee(totalFee: number, discount = 0): number {
  return Math.max(0, Number(totalFee) - Number(discount || 0));
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

/**
 * Resolve net payable from a stored fee record.
 * Admissions / create-fee persist `totalFee` as NET (originalFee - discount).
 * Subtracting `discount` again would make payable ₹0 and block valid payments.
 */
export function getRecordPayableFee(record: FeeRecordAmounts): number {
  const storedTotal = Number(record.totalFee) || 0;
  const originalFee = Number(record.originalFee) || 0;
  const discount = Number(record.discount) || 0;
  const paid = Number(record.paidAmount) || 0;
  const remaining = Number(record.remainingFee);

  if (Number.isFinite(remaining) && remaining >= 0 && paid + remaining > 0) {
    return paid + remaining;
  }

  if (originalFee > 0) {
    return storedTotal > 0 ? storedTotal : getPayableFee(originalFee, discount);
  }

  return storedTotal;
}

export function validateInstallmentPayment(
  record: FeeRecordAmounts,
  installmentAmount: number,
): string | null {
  if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
    return "Paid amount must be greater than 0.";
  }

  const paid = Number(record.paidAmount) || 0;
  const payable = getRecordPayableFee(record);
  const remaining = Number.isFinite(Number(record.remainingFee))
    ? Math.max(0, Number(record.remainingFee))
    : Math.max(0, payable - paid);

  if (installmentAmount > remaining) {
    return `Paid amount (₹${installmentAmount.toLocaleString("en-IN")}) cannot exceed remaining balance (₹${remaining.toLocaleString("en-IN")}).`;
  }

  const newPaid = paid + installmentAmount;
  if (newPaid > payable) {
    return `Paid amount (₹${newPaid.toLocaleString("en-IN")}) cannot exceed payable fee (₹${payable.toLocaleString("en-IN")}).`;
  }
  return null;
}

export function getRecordRemainingFee(record: FeeRecordAmounts, newPaidAmount: number): number {
  return Math.max(0, getRecordPayableFee(record) - newPaidAmount);
}
