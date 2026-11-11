import { db } from "@/server/db";
import { handle, requireSession } from "@/server/http";
import { ApiError } from "@/server/repo";
import { unfurl } from "@/server/unfurl";

export const dynamic = "force-dynamic";

const buckets = new Map<string, number[]>();

export function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const now = Date.now();
    const list = (buckets.get(s.uid) ?? []).filter((t) => now - t < 60_000);
    if (list.length >= 40) throw new ApiError(429, "Too many previews.");
    list.push(now);
    buckets.set(s.uid, list);
    const url = new URL(req.url).searchParams.get("url") ?? "";
    if (!url || url.length > 2000) throw new ApiError(400, "Missing url.");
    return { preview: await unfurl(await db(), url) };
  });
}
