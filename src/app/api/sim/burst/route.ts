import { ApiError } from "@/server/repo";
import { burst } from "@/server/floor";
import { handle, requireDb, requireSession } from "@/server/http";
import { SIM_CHANNEL_WEIGHTS } from "@/lib/sim/planner";

export function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    if (s.role !== "owner") throw new ApiError(403, "Backstage is owner-only.");
    const body = (await req.json().catch(() => ({}))) as { channelId?: string };
    const channelId = body.channelId && SIM_CHANNEL_WEIGHTS[body.channelId] ? body.channelId : "c_general";
    return { scheduled: await burst(await requireDb(), channelId) };
  });
}
