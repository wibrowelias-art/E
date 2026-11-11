import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { readUpload } from "@/server/uploads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Sign in first.", { status: 401 });
  const c = await db();
  const { id } = await ctx.params;
  const file = c ? await readUpload(c, id) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
