/**
 * pnpm seed — validates the cast + channel map + backlog and writes a JSON
 * snapshot to data/seed.json (consumed by the Phase 2 DB seeder).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { GUILDS } from "../src/data/guilds";
import { NPC_PROFILES, ROLES } from "../src/data/npcs";
import { buildSeed, validateSeed } from "../src/data/seed";

const errors = validateSeed();
if (errors.length) {
  console.error("Seed validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
const snap = buildSeed(Date.now());
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/seed.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), roles: ROLES, guilds: GUILDS, users: snap.users, npcProfiles: NPC_PROFILES, messages: snap.messages }, null, 2),
);
const npcs = snap.users.filter((u) => u.isNpc).length;
const eliasRefs = snap.messages.filter((m) => /elias|lounge|imageforge|spotly/i.test(m.content)).length;
console.log(`✓ ${GUILDS.length} guilds, ${GUILDS.reduce((n, g) => n + g.channels.length, 0)} channels`);
console.log(`✓ ${npcs} NPCs (ages ${Math.min(...NPC_PROFILES.map((p) => p.age))}–${Math.max(...NPC_PROFILES.map((p) => p.age))})`);
console.log(`✓ ${snap.messages.length} backlog messages, all unique; ${eliasRefs} reference Elias / The Lounge / his apps (${Math.round((eliasRefs / snap.messages.length) * 100)}%)`);
console.log("→ wrote data/seed.json");
