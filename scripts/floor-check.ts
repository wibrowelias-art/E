/**
 * pnpm floor:check — server floor planner, tested in memory with a simulated
 * clock (the same Planner the server tick uses). Ticks every 4s with a 12s
 * lookahead, exactly like src/server/floor.ts.
 */
import { buildSeed, fingerprint } from "../src/data/seed";
import { DEFAULT_SIM } from "../src/lib/sim/settings";
import { expectedMessages, initialPlannerState, Planner, type World } from "../src/lib/sim/planner";
import type { Message, SimSettings } from "../src/lib/types";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};

const T0 = Date.UTC(2026, 10, 6, 20, 30); // 21:30 in Hamburg — prime time
function makeWorld(patch: Partial<SimSettings> = {}, now = T0): World {
  const seed = buildSeed(now);
  const recent = new Map<string, Message[]>();
  for (const m of seed.messages) (recent.get(m.channelId) ?? recent.set(m.channelId, []).get(m.channelId)!).push(m);
  return { settings: { ...DEFAULT_SIM, ...patch }, users: new Map(seed.users.map((u) => [u.id, { ...u }])), recent, texts: seed.messages.map((m) => m.i18n?.en ?? m.content), rng: Math.random };
}
/** Simulate server ticks every 4s with a 12s lookahead; return messages visible by `until`. */
function run(world: World, ms: number, start = T0) {
  const state = initialPlannerState(start);
  const all: Message[] = [];
  const typingSeen: number[] = [];
  for (let now = start; now <= start + ms; now += 4000) {
    const p = new Planner(world, state);
    p.advance(now, now + 12_000);
    for (const e of p.events) if (e.kind === "message") all.push(e.message), e.typingMs > 0 && typingSeen.push(e.typingMs);
  }
  return { msgs: all.filter((m) => m.createdAt <= start + ms), typingSeen };
}
const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
function nearDup(texts: string[]) {
  let pairs = 0;
  const s = texts.map(tokens);
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i]!, b = s[j]!;
      if (a.size < 3 || b.size < 3) continue;
      let inter = 0;
      for (const w of a) if (b.has(w)) inter++;
      if (inter / (a.size + b.size - inter) >= 0.8) pairs++;
    }
  return pairs;
}
const share = (m: Message[], tags: string[]) => m.filter((x) => tags.includes(x.simTag ?? "")).length / Math.max(1, m.length);

// 1. cold open + 5 minutes
{
  const w = makeWorld();
  const first = run(w, 15_000).msgs;
  ok(first.length >= 3, `15s after start: ${first.length} messages (≥3)`);
  ok(first.some((m) => m.replyToId), "15s: at least one reply");
  const five = run(makeWorld(), 300_000);
  const m = five.msgs;
  ok(m.length >= 40, `5 minutes: ${m.length} messages across ${new Set(m.map((x) => x.channelId)).size} channels (≥40)`);
  ok(nearDup(m.map((x) => x.i18n!.en)) < 2, `near-duplicate pairs: ${nearDup(m.map((x) => x.i18n!.en))}`);
  const fps = m.map((x) => fingerprint(x.i18n!.en)).filter((f) => f.length > 3);
  const exact = fps.length - new Set(fps).size;
  ok(exact === 0, `exact duplicates: ${exact}`);
  const elias = m.filter((x) => /elias|lounge|imageforge|spotly/i.test(x.i18n!.en)).length;
  ok(elias >= 10 && elias < m.length, `Elias/Lounge references: ${elias} of ${m.length}`);
  ok(m.filter((x) => x.replyToId).length / m.length >= 0.35, `reply share ${Math.round((m.filter((x) => x.replyToId).length / m.length) * 100)}%`);
  let maxRun = 0;
  for (const ch of new Set(m.map((x) => x.channelId))) {
    let r = 0, prev = "";
    for (const x of m.filter((y) => y.channelId === ch).sort((a, b) => a.createdAt - b.createdAt)) {
      r = x.authorId === prev ? r + 1 : 1;
      prev = x.authorId;
      maxRun = Math.max(maxRun, r);
    }
  }
  ok(maxRun <= 2, `max posts in a row: ${maxRun}`);
  ok(five.typingSeen.every((t) => t >= 300 && t <= 2600), `typing times 300–2600ms (${Math.min(...five.typingSeen)}–${Math.max(...five.typingSeen)})`);
  ok(m.every((x) => x.authorId.startsWith("u_") && x.authorId !== "u_elias" && x.authorId !== "u_doorman"), "never posts as Elias or the bot");
}
// 2. sliders
{
  const pos = (m: Message[]) => share(m, ["worship", "praise", "ownerPos"]);
  const neg = (m: Message[]) => share(m, ["roast", "critical", "ownerNeg"]);
  const hate = run(makeWorld({ glaze: 0 }), 300_000).msgs;
  const love = run(makeWorld({ glaze: 100 }), 300_000).msgs;
  ok(pos(hate) === 0 && neg(hate) > 0.1, `glaze 0%: ${Math.round(neg(hate) * 100)}% roast/critical, 0 praise`);
  ok(neg(love) === 0 && pos(love) > 0.1, `glaze 100%: ${Math.round(pos(love) * 100)}% praise, 0 roast`);
  const calm = run(makeWorld({ drama: 0 }), 600_000).msgs;
  const messy = run(makeWorld({ drama: 100 }), 600_000).msgs;
  ok(share(messy, ["drama", "disagree"]) > 3 * share(calm, ["drama", "disagree"]), `drama 0 → 100: ${Math.round(share(calm, ["drama", "disagree"]) * 100)}% → ${Math.round(share(messy, ["drama", "disagree"]) * 100)}%`);
  const sleepy = run(makeWorld({ activity: 0.25 }), 180_000).msgs.length;
  const chaos = run(makeWorld({ activity: 3 }), 180_000).msgs.length;
  ok(chaos > 4 * sleepy, `activity: sleepy ${sleepy} vs chaos ${chaos} in 3 min`);
  const prompted = run(makeWorld({ prompt: "Talk about the rooftop party on Friday and vintage cameras. Be hyped." }), 180_000).msgs;
  const hits = prompted.filter((x) => /rooftop party on friday|vintage cameras/i.test(x.i18n!.en)).length;
  ok(hits >= 3, `vibe prompt: ${hits} lines on the topics`);
  const muted = run(makeWorld({ muted: ["u_mara", "u_tarek", "u_jonas"] }), 300_000).msgs;
  ok(!muted.some((x) => ["u_mara", "u_tarek", "u_jonas"].includes(x.authorId)), "muted NPCs never post");
  const meta = run(makeWorld({ breakCharacter: true, activity: 2 }), 300_000).msgs;
  ok(meta.some((x) => x.simTag === "meta"), "break character → meta lines");
}
// 3. catch-up after 6 hours away (how src/server/floor.ts sizes it)
{
  const w = makeWorld();
  const state = initialPlannerState(T0);
  const gap = 6 * 3600_000;
  const p = new Planner(w, state);
  const expected = expectedMessages(1, T0, T0 + gap);
  const n = p.advance(T0, T0 + gap, { density: Math.min(1, 100 / expected), past: true, maxMessages: 100 });
  const msgs = p.events.flatMap((e) => (e.kind === "message" ? [e.message] : []));
  ok(n <= 100 && n >= 30, `6h catch-up: ${n} messages (30–100)`);
  const spread = (Math.max(...msgs.map((m) => m.createdAt)) - Math.min(...msgs.map((m) => m.createdAt))) / gap;
  ok(spread > 0.75, `catch-up spread over ${Math.round(spread * 100)}% of the gap`);
  ok(msgs.every((m) => p.events.find((e) => e.kind === "message" && e.message.id === m.id && e.typingMs === 0)), "backfilled history has no typing");
  // night vs early morning density
  const night = run(makeWorld(), 600_000, Date.UTC(2026, 10, 6, 21, 0)).msgs.length; // 22:00 local
  const dawn = run(makeWorld(), 600_000, Date.UTC(2026, 10, 7, 5, 0)).msgs.length; // 06:00 local
  ok(night > dawn * 2, `time of day: 22:00 → ${night}, 06:00 → ${dawn} messages in 10 min`);
}
// 4. replies to humans + burst
{
  const w = makeWorld();
  const human: Message = { id: "m_h_test", channelId: "c_general", authorId: "u_elias", content: "who's coming tonight?", createdAt: T0, isHuman: true };
  w.recent.get("c_general")!.push(human);
  const p = new Planner(w, initialPlannerState(T0));
  p.replyToHuman(human, T0);
  const r = p.events.flatMap((e) => (e.kind === "message" ? [e.message] : []));
  ok(r.length >= 1 && r.length <= 3 && r.every((m) => m.createdAt - T0 < 15_000), `owner post → ${r.length} replies within ${Math.round((Math.max(...r.map((m) => m.createdAt)) - T0) / 1000)}s`);
  ok(r.some((m) => m.replyToId === human.id), "at least one reply references the owner's message");
  const guest = { ...human, id: "m_h_guest", authorId: "u_guest_x", channelId: "c_intros" };
  w.users.set("u_guest_x", { id: "u_guest_x", username: "testy", displayName: "Testy", avatar: { from: "#000", to: "#fff", initials: "T" }, roleId: "tourist", isNpc: false, isHuman: true, presence: "online" });
  const g = new Planner(w, initialPlannerState(T0));
  g.replyToHuman(guest, T0);
  const gm = g.events.flatMap((e) => (e.kind === "message" ? [e.message] : []));
  ok(gm.length === 1 && gm[0]!.simTag === "greet" && gm[0]!.replyToId === guest.id && !gm[0]!.i18n!.en.includes("{"), `guest in #introductions → welcome: "${gm[0]?.i18n?.en}"`);
  const b = new Planner(makeWorld(), initialPlannerState(T0));
  b.burst("c_memes", T0);
  const bm = b.events.flatMap((e) => (e.kind === "message" ? [e.message] : []));
  ok(bm.length >= 5 && bm.every((m) => m.channelId === "c_memes" && m.createdAt - T0 < 12_000), `burst → ${bm.length} messages in #memes within 12s`);
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
