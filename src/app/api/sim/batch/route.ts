import { handle, requireDb, requireSession } from "@/server/http";
import { simBatch } from "@/server/repo";

export function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    return simBatch(c, s, await req.json().catch(() => ({})));
  });
}
