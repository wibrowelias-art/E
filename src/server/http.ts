import { NextResponse } from "next/server";
import { ELIAS } from "@/data/npcs";
import type { User } from "@/lib/types";
import { getSession, type Session } from "./auth";
import { db } from "./db";
import { ApiError } from "./repo";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[lounge] api error", e);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new ApiError(401, "Sign in first.");
  return s;
}

export async function requireDb() {
  const c = await db();
  if (!c) throw new ApiError(503, "No database configured — running in local mode.");
  return c;
}

/** The signed-in person as a User object (works without a database too). */
export function sessionUser(s: Session): User {
  if (s.role === "owner") return ELIAS;
  const [from, to] = s.grad ?? ["#5ee7df", "#4a6cf7"];
  return {
    id: s.uid,
    username: s.name.toLowerCase().replace(/\s+/g, "."),
    displayName: s.name,
    avatar: { from, to, initials: s.name.slice(0, 1).toUpperCase() },
    roleId: "tourist",
    isNpc: false,
    isHuman: true,
    presence: "online",
  };
}
