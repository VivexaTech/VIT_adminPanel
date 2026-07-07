/** Generate student ID like VIT25001 (VIT + YY + 3-digit sequence) */
export function formatStudentId(sequence: number, year = new Date().getFullYear()): string {
  const yy = String(year).slice(-2);
  return `VIT${yy}${String(sequence).padStart(3, "0")}`;
}

export function buildStudentLoginEmail(studentId: string): string {
  return `${studentId.toLowerCase()}@vivexatech.in`;
}

import { randomInt } from "crypto";

export function generateSixDigitPassword(): string {
  return String(randomInt(100000, 1000000));
}
