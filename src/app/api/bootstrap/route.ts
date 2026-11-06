import { db, persistenceError } from "@/server/db";
import { maybeTick } from "@/server/floor";
import { handle, requireSession, sessionUser } from "@/server/http";
import { bootstrap } from "@/server/repo";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const s = await requireSession();
    const c = await db();
    if (!c) return { persistence: false, persistenceError, viewer: sessionUser(s), role: s.role };
    await maybeTick(c); // returning after a long time → history is filled in first
    return { persistence: true, viewer: sessionUser(s), role: s.role, ...(await bootstrap(c, s)) };
  });
}
