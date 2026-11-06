import { NextResponse } from "next/server";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { tick } from "@/server/floor";

export const dynamic = "force-dynamic";

/**
 * Advance the floor now. For external schedulers (Vercel Cron, cron-job.org…):
 * send `Authorization: Bearer $CRON_SECRET`. The owner may call it too.
 * `?rewind=<ms>` (only with LOUNGE_ALLOW_TEST_HOOKS=1) pretends nobody was here
 * for that long — used by `pnpm api:check` to test the catch-up.
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const session = await getSession();
  if (!(secret && bearer) && session?.role !== "owner") return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const c = await db();
  if (!c) return NextResponse.json({ error: "No database configured." }, { status: 503 });
  const rewind = Number(new URL(req.url).searchParams.get("rewind") ?? 0);
  if (rewind > 0 && process.env.LOUNGE_ALLOW_TEST_HOOKS === "1") {
    await c.execute({ sql: "UPDATE sim_state SET last_planned_at = ?, last_tick_at = NULL, lease_until = NULL WHERE id = 1", args: [Date.now() - rewind] });
  }
  return NextResponse.json(await tick(c, { force: true }), { headers: { "Cache-Control": "no-store" } });
}

export const GET = handler;
export const POST = handler;
