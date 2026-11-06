import { handle, requireDb, requireSession } from "@/server/http";
import { toggleHumanReaction } from "@/server/repo";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { emoji?: unknown };
    return { message: await toggleHumanReaction(c, s, id, body.emoji) };
  });
}
