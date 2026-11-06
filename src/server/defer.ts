import { after } from "next/server";

/**
 * Run work after the response is sent (Vercel keeps the function alive for it).
 * Outside a request (scripts, tests) it simply runs in the background.
 */
export function defer(task: () => Promise<void>) {
  const run = () => task().catch((e) => console.error("[lounge] deferred task failed", e));
  try {
    after(run);
  } catch {
    void run();
  }
}
