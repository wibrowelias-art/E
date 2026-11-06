import { handle, requireDb, requireSession } from "@/server/http";
import { editHuman } from "@/server/repo";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const c = await requireDb();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { content?: unknown };
    return { message: await editHuman(c, s, id, body.content) };
  });
}
