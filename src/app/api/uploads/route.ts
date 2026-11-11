import { handle, requireDb, requireSession } from "@/server/http";
import { createUpload } from "@/server/uploads";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    return createUpload(c, s, await req.json().catch(() => ({})));
  });
}
