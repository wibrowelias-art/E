import { db } from "./db";
import { maybeTick, TICK_EVERY_MS } from "./floor";

const KEY = Symbol.for("lounge.floorTicker");

export function startTicker() {
  const g = globalThis as unknown as Record<symbol, ReturnType<typeof setInterval> | undefined>;
  if (g[KEY]) return; // dev hot reload / multiple imports → one ticker
  g[KEY] = setInterval(async () => {
    const c = await db();
    if (c) await maybeTick(c);
  }, TICK_EVERY_MS);
  g[KEY]!.unref?.();
  console.log("[lounge] floor ticker running every", TICK_EVERY_MS / 1000, "s");
}
