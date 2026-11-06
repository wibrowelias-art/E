import { NextResponse } from "next/server";
import { checkOwnerCredentials, cookieOptions, ownerConfigured, ownerSession, SESSION_COOKIE, signSession } from "@/server/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!ownerConfigured()) {
    return NextResponse.json({ error: "Owner login isn't set up. Set LOUNGE_OWNER_EMAIL and LOUNGE_OWNER_PASSWORD." }, { status: 503 });
  }
  if (!checkOwnerCredentials(String(body.email ?? ""), String(body.password ?? ""))) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return NextResponse.json({ error: "Login or password is invalid." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(ownerSession()), cookieOptions());
  return res;
}
