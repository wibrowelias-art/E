// Tiny .env.local reader for the test scripts (no dependency).
import { existsSync, readFileSync } from "node:fs";
export function loadEnv(file = ".env.local") {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
export const env = { ...loadEnv(), ...process.env };
export const OWNER = { email: env.LOUNGE_OWNER_EMAIL, password: env.LOUNGE_OWNER_PASSWORD };
/** Log a Playwright context in as the owner (cookies stay in the context). */
export async function loginOwner(ctx, base) {
  // `next dev` compiles routes on demand and can 500 while a manifest is being written — retry.
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.request.post(`${base}/api/auth/login`, { data: OWNER });
    if (res.ok()) return;
    if (res.status() !== 500 || attempt >= 4) throw new Error(`owner login failed: ${res.status()}`);
    await new Promise((r) => setTimeout(r, 800));
  }
}
