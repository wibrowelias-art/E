import { NextResponse } from "next/server";
import { cookieOptions, ownerConfigured, ownerSession, SESSION_COOKIE, signSession } from "@/server/auth";
import { db } from "@/server/db";

/** Demo owner: only while no owner password exists AND nothing is persisted. */
export async function POST() {
  if (ownerConfigured() || (await db())) {
    return NextResponse.json({ error: "Demo mode is off — sign in with the owner account." }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(ownerSession()), cookieOptions());
  return res;
}
