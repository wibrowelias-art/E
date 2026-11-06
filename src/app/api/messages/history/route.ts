import { handle, requireDb, requireSession } from "@/server/http";
import { history } from "@/server/repo";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    const p = new URL(req.url).searchParams;
    return history(c, s, String(p.get("channel") ?? ""), Number(p.get("before") ?? Date.now()), Number(p.get("limit") ?? 80));
  });
}
