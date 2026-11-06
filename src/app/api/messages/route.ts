import { handle, requireDb, requireSession } from "@/server/http";
import { postHuman } from "@/server/repo";

export function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    const message = await postHuman(c, s, await req.json().catch(() => ({})));
    return { message };
  });
}
