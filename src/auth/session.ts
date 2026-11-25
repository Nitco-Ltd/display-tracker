// Sign-in session: an httpOnly cookie "dt_session" = base64url({ e: email, x: expiry }) + "." + HMAC-SHA256(AUTH_SECRET).
// No session store needed; the user row (role, zone, active) is re-read on every request, so disabling a user
// or changing their role takes effect immediately.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { config, isReadOnly } from "@/lib/config";

export const SESSION_COOKIE = "dt_session";
export const SESSION_DAYS = 7;

/** Login is required on the cloud host always, and anywhere AUTH_SECRET is set. */
export function loginRequired(): boolean {
  return isReadOnly() || !!config().AUTH_SECRET;
}

function secret(): string {
  const s = config().AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters");
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function createSessionToken(email: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ e: email.toLowerCase(), x: now + SESSION_DAYS * 86_400_000 }));
  return `${payload}.${sign(payload)}`;
}

/** Email in a valid, unexpired token, else null. */
export function readSessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e: string; x: number };
    return typeof e === "string" && typeof x === "number" && x > now ? e : null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = scryptSync(password, Buffer.from(salt, "base64"), want.length);
  return timingSafeEqual(got, want);
}

/** Random password for a new user, e.g. "k7Fq-2mor-a9xL-pQ3z". */
export function generatePassword(): string {
  const r = randomBytes(12).toString("base64url").replace(/[-_]/g, "x");
  return `${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 12)}-${r.slice(12, 16)}`;
}
