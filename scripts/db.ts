/**
 * pnpm db:reset — wipe and re-seed the database (DATABASE_URL or ./data/lounge.db).
 * pnpm db:status — show row counts.
 */
import { db, databaseUrl, resetDatabase } from "../src/server/db";

const cmd = process.argv[2] ?? "status";
const c = await db();
if (!c) {
  console.error(`No database available (url: ${databaseUrl() ?? "none"}).`);
  process.exit(1);
}
if (cmd === "reset") {
  await resetDatabase(c);
  console.log("✓ database reset and re-seeded");
}
for (const t of ["users", "messages", "reactions", "reaction_users", "channels", "npc_profiles", "relationships"]) {
  const r = await c.execute(`SELECT COUNT(*) AS n FROM ${t}`);
  console.log(`${t.padEnd(16)} ${r.rows[0]?.n}`);
}
c.close();
