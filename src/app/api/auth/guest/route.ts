import { NextResponse } from "next/server";
import { cookieOptions, guestSession, SESSION_COOKIE, signSession } from "@/server/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(guestSession(body.name)), cookieOptions());
  return res;
}
