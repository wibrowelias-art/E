/**
 * pnpm floor:sample — print a stretch of the floor (EN) as it would appear,
 * with typing times, for eyeballing the NPC style. Not a test.
 *   pnpm floor:sample [minutes=10] [hamburgHour=21.5]
 */
import { buildSeed } from "../src/data/seed";
import { DEFAULT_SIM } from "../src/lib/sim/settings";
import { initialPlannerState, Planner, type FloorEvent, type World } from "../src/lib/sim/planner";
import type { Message } from "../src/lib/types";

const minutes = Number(process.argv[2] ?? 10);
const hour = Number(process.argv[3] ?? 21.5);
const start = Date.UTC(2026, 10, 6, 0, 0) + (hour - 1) * 3600_000; // CET = UTC+1
const seed = buildSeed(start);
const recent = new Map<string, Message[]>();
for (const m of seed.messages) (recent.get(m.channelId) ?? recent.set(m.channelId, []).get(m.channelId)!).push(m);
const world: World = { settings: { ...DEFAULT_SIM }, users: new Map(seed.users.map((u) => [u.id, { ...u }])), recent, texts: seed.messages.map((m) => m.i18n?.en ?? m.content), rng: Math.random };
const state = initialPlannerState(start);
const events: FloorEvent[] = [];
for (let now = start; now <= start + minutes * 60_000; now += 4000) {
  const p = new Planner(world, state);
  p.advance(now, now + 12_000);
  if (now === start + 60_000) {
    const human: Message = { id: "m_h_sample", channelId: "c_general", authorId: "u_elias", content: "who's coming to the photo walk tonight?", createdAt: now, isHuman: true };
    world.recent.get("c_general")!.push(human);
    console.log(`[human] elias: ${human.content}`);
    p.replyToHuman(human, now);
  }
  events.push(...p.events);
}
const name = (id: string) => world.users.get(id)?.displayName ?? id;
const t0 = start;
for (const e of events.filter((x): x is Extract<FloorEvent, { kind: "message" }> => x.kind === "message").sort((a, b) => a.message.createdAt - b.message.createdAt)) {
  const m = e.message;
  const s = ((m.createdAt - t0) / 1000).toFixed(1).padStart(6);
  console.log(`${s}s #${m.channelId.slice(2).padEnd(7)} ${name(m.authorId).padEnd(8)} (${(e.typingMs / 1000).toFixed(1)}s) ${m.replyToId ? "↪ " : ""}${m.i18n!.en}${m.replyToId === "m_h_sample" ? "   [→ elias]" : ""}  {${m.simTag}}`);
}
for (const e of events) if (e.kind === "reaction" && e.by) console.log(`reaction ${e.emoji} by ${name(e.by)}${e.instead ? " (instead of a reply)" : ""} at ${((e.at - t0) / 1000).toFixed(1)}s`);
