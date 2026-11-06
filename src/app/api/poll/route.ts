import { handle, requireDb, requireSession } from "@/server/http";
import { poll } from "@/server/repo";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    const since = Number(new URL(req.url).searchParams.get("since") ?? 0) || 0;
    return poll(c, s, since);
  });
}
