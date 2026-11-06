/**
 * Auth (Phase 2): password login for the owner (bootstrapped from env), guest
 * "Tourist" sessions, and a demo-owner mode that only exists while no owner
 * password is configured AND nothing is persisted (local mode).
 *
 * Sessions are stateless signed cookies (HMAC-SHA256), so they work on Vercel
 * with or without a database.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { OWNER_ID } from "@/data/npcs";
import type { RoleId } from "@/lib/types";

export const SESSION_COOKIE = "lounge_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

export interface Session {
  uid: string;
  role: RoleId;
  name: string;
  /** Guests carry their avatar so local mode can render them without a DB. */
  grad?: [string, string];
  exp: number;
}

const ownerEmail = () => (process.env.LOUNGE_OWNER_EMAIL ?? "").trim().toLowerCase();
const ownerPassword = () => process.env.LOUNGE_OWNER_PASSWORD ?? "";

/** Owner login is possible only with real credentials (never the example ones in production). */
export function ownerConfigured(): boolean {
  if (!ownerEmail() || !ownerPassword()) return false;
  if (process.env.NODE_ENV === "production" && ownerPassword() === "change-me") return false;
  return true;
}

let processSecret: string | undefined;
function secret(): string {
  if (process.env.LOUNGE_SESSION_SECRET) return process.env.LOUNGE_SESSION_SECRET;
  if (ownerPassword()) return createHash("sha256").update(`lounge-session|${ownerEmail()}|${ownerPassword()}`).digest("hex");
  processSecret ??= randomBytes(32).toString("hex"); // demo only: sessions reset on restart
  return processSecret;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signSession(s: Omit<Session, "exp">): string {
  const payload = b64(JSON.stringify({ ...s, exp: Date.now() + MAX_AGE_S * 1000 }));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof s.exp !== "number" || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  };
}

/** Constant-time credential check against the env-configured owner. */
export function checkOwnerCredentials(email: string, password: string): boolean {
  if (!ownerConfigured()) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  const okEmail = timingSafeEqual(h(email.trim().toLowerCase()), h(ownerEmail()));
  const okPass = timingSafeEqual(h(password), h(ownerPassword()));
  return okEmail && okPass;
}

export function ownerSession(): Omit<Session, "exp"> {
  return { uid: OWNER_ID, role: "owner", name: "Elias" };
}

const GUEST_GRADS: Array<[string, string]> = [
  ["#5ee7df", "#4a6cf7"],
  ["#f6d365", "#fda085"],
  ["#a18cd1", "#fbc2eb"],
  ["#84fab0", "#3f9f7f"],
  ["#ff9a9e", "#c94b6d"],
];

export function guestSession(rawName: unknown): Omit<Session, "exp"> {
  const cleaned = typeof rawName === "string" ? rawName.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 24) : "";
  const suffix = randomBytes(2).toString("hex");
  const name = cleaned.length >= 2 ? cleaned : `Tourist ${suffix.toUpperCase()}`;
  return {
    uid: `u_guest_${randomBytes(6).toString("hex")}`,
    role: "tourist",
    name,
    grad: GUEST_GRADS[randomBytes(1)[0]! % GUEST_GRADS.length],
  };
}
