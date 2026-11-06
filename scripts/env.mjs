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
  const res = await ctx.request.post(`${base}/api/auth/login`, { data: OWNER });
  if (!res.ok()) throw new Error(`owner login failed: ${res.status()} ${await res.text()}`);
}
