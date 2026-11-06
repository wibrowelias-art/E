import { maybeTick } from "@/server/floor";
import { handle, requireDb, requireSession } from "@/server/http";
import { poll } from "@/server/repo";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    await maybeTick(c); // lazy tick: any visitor keeps the floor moving
    const p = new URL(req.url).searchParams;
    return poll(c, s, Number(p.get("since") ?? 0) || 0, Number(p.get("after") ?? 0) || 0);
  });
}
