const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*";

/** Cryptographically secure random password for temporary credentials */
export function generateSecurePassword(length = 12): string {
  const minLen = Math.max(10, length);
  const all = UPPER + LOWER + DIGITS + SYMBOLS;

  const pick = (chars: string) => chars[secureRandomInt(chars.length)];
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];

  const rest: string[] = [];
  for (let i = required.length; i < minLen; i++) {
    rest.push(pick(all));
  }

  const combined = [...required, ...rest];
  shuffle(combined);
  return combined.join("");
}

function secureRandomInt(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) return "Include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  return null;
}

export async function generateStaffId(
  role: string,
  getNext: (key: string) => Promise<number>
): Promise<string> {
  if (role === "Trainer" || role === "Teaching Team") {
    const n = await getNext("staff_trainer_counter");
    return `TRN-${String(n).padStart(3, "0")}`;
  }
  const n = await getNext("staff_admin_counter");
  return `ADM-${String(n).padStart(3, "0")}`;
}
