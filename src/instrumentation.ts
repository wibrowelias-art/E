/**
 * Long-running servers (`pnpm start`, `pnpm dev`, Docker) tick the floor every
 * few seconds even with nobody connected. On Vercel functions freeze between
 * requests, so there the floor advances lazily on each poll instead (and can be
 * nudged by a cron hitting /api/sim/tick).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.VERCEL || process.env.LOUNGE_FLOOR_TICKER === "off") return;
    const { startTicker } = await import("./server/ticker");
    startTicker();
  }
}
