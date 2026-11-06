import { ApiError, getSim, putSim } from "@/server/repo";
import { handle, requireDb, requireSession } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const s = await requireSession();
    if (s.role !== "owner") throw new ApiError(403, "Backstage is owner-only.");
    return { sim: await getSim(await requireDb()) };
  });
}

export function PUT(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    return { sim: await putSim(await requireDb(), s, await req.json().catch(() => ({}))) };
  });
}
