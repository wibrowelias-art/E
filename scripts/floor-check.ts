/**
 * pnpm floor:check — server floor planner, tested in memory with a simulated
 * clock (the same Planner the server tick uses). Ticks every 4s with a 12s
 * lookahead, exactly like src/server/floor.ts. Section 5 covers "NPCs that feel
 * human": reply timing, bursts, typos, style, lore, callbacks, rivals, presence.
 */
import { buildSeed, fingerprint } from "../src/data/seed";
import { DEFAULT_SIM } from "../src/lib/sim/settings";
import { NPC_USERS, PERSONALITIES } from "../src/data/npcs";
import { expectedMessages, initialPlannerState, Planner, presenceTarget, type FloorEvent, type World } from "../src/lib/sim/planner";
import { EMOJI_RE } from "../src/lib/sim/style";
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
      if (inter / (a.size + b.size - inter) >= 0.8) pairs++, process.env.SHOW_DUPS && console.log("near-dup:", texts[i], "/", texts[j]);
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
  // ≤3, not ≤2: people now send 2–3 short messages in a row instead of one long one.
  ok(maxRun <= 3, `max posts in a row: ${maxRun} (≤3)`);
  // Typing follows each persona's typing speed now (was a flat 0.3–2.6 s).
  ok(five.typingSeen.every((t) => t >= 600 && t <= 12_000), `typing times 0.6–12 s (${Math.min(...five.typingSeen)}–${Math.max(...five.typingSeen)} ms)`);
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
  const D = ["drama", "disagree", "bicker"];
  ok(share(messy, D) > 3 * share(calm, D), `drama 0 → 100: ${Math.round(share(calm, D) * 100)}% → ${Math.round(share(messy, D) * 100)}%`);
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
// 4. Backstage burst + guest welcome
{
  const b = new Planner(makeWorld(), initialPlannerState(T0));
  b.burst("c_memes", T0);
  const bm = b.events.flatMap((e) => (e.kind === "message" ? [e.message] : []));
  ok(bm.length >= 5 && bm.every((m) => m.channelId === "c_memes" && m.createdAt - T0 < 12_000), `burst → ${bm.length} messages in #memes within 12s`);
  // A guest says hi in #introductions → usually someone welcomes them (2–40 s later, typing first).
  let welcomed = 0;
  let sample = "";
  for (let i = 0; i < 20; i++) {
    const w = makeWorld();
    const guest: Message = { id: `m_h_guest${i}`, channelId: "c_intros", authorId: "u_guest_x", content: "hi! just got the invite", createdAt: T0, isHuman: true };
    w.users.set("u_guest_x", { id: "u_guest_x", username: "testy", displayName: "Testy", avatar: { from: "#000", to: "#fff", initials: "T" }, roleId: "tourist", isNpc: false, isHuman: true, presence: "online" });
    (w.recent.get("c_intros") ?? w.recent.set("c_intros", []).get("c_intros")!).push(guest);
    const g = new Planner(w, initialPlannerState(T0));
    g.replyToHuman(guest, T0);
    const head = g.events.find((e) => e.kind === "message" && e.message.replyToId === guest.id);
    if (head?.kind === "message" && head.message.simTag === "greet" && head.message.createdAt - T0 >= 2000 && head.message.createdAt - T0 <= 40_000 && !head.message.i18n!.en.includes("{")) {
      welcomed++;
      sample ||= head.message.i18n!.en;
    }
  }
  ok(welcomed === 20, `guest in #introductions → welcomed in ${welcomed}/20 cases (e.g. "${sample}")`);
}

/* ───────────── 5. NPCs that feel human ───────────── */
const msgsOf = (events: FloorEvent[]) => events.flatMap((e) => (e.kind === "message" ? [e] : []));
// 5a. answering a human
{
  const QUESTIONS = ["who's coming tonight?", "what are we eating later", "anyone at the elbstrand?", "should i post the new invite cards?", "how was the set yesterday?"];
  const STATEMENTS = ["just finished editing the harbour shots", "door opens at 23:00 tonight", "new invite cards are done", "the vlog is almost ready", "back from the photo walk, soaked"];
  const posts = 160;
  let none = 0, three = 0, writersTotal = 0, insteadOfReply = 0, badTiming = 0, untyped = 0, multiPart = 0, over3 = 0;
  const delays: number[] = [];
  for (let i = 0; i < posts; i++) {
    const w = makeWorld();
    const at = T0 + i * 60_000;
    const text = (i % 2 ? QUESTIONS : STATEMENTS)[i % 5]!;
    const human: Message = { id: `m_h_${i}`, channelId: "c_general", authorId: "u_elias", content: text, createdAt: at, isHuman: true };
    w.recent.get("c_general")!.push(human);
    const p = new Planner(w, initialPlannerState(at));
    p.replyToHuman(human, at);
    const ms = msgsOf(p.events);
    const writers = new Set(ms.map((e) => e.message.authorId));
    writersTotal += writers.size;
    if (writers.size === 0) none++;
    if (writers.size === 3) three++;
    if (writers.size > 3) over3++;
    if (ms.some((e) => (e.part ?? 0) > 0)) multiPart++;
    insteadOfReply += p.events.filter((e) => e.kind === "reaction" && e.instead && e.messageId === human.id).length;
    for (const e of ms) {
      if (e.typingMs <= 0 || e.message.createdAt - e.typingMs < at) untyped++;
      if (e.part === 0) {
        const d = e.message.createdAt - at;
        delays.push(d);
        if (d < 2000 || d > 40_000) badTiming++;
      }
    }
  }
  const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);
  ok(badTiming === 0 && delays.length > 0, `replies to a human land 2–40 s after the post (${(Math.min(...delays) / 1000).toFixed(1)}–${(Math.max(...delays) / 1000).toFixed(1)} s, avg ${(avg(delays) / 1000).toFixed(1)} s)`);
  ok(untyped === 0, `every reply shows typing first, starting after the human posted (${untyped} without)`);
  ok(none > 0 && none / posts < 0.35, `nobody writes back to ${Math.round((none / posts) * 100)}% of owner posts (>0, <35%)`);
  ok(over3 === 0 && three / posts <= 0.2, `never everyone: max 3 writers, 3 only in ${Math.round((three / posts) * 100)}% of posts; avg ${(writersTotal / posts).toFixed(2)} writers`);
  ok(insteadOfReply > 0, `reactions instead of replies on the owner's posts: ${insteadOfReply}`);
  ok(multiPart > 0, `answers sent as 2–3 messages in a row: ${multiPart} of ${posts} posts`);
  // Whoever is named answers.
  let named = 0;
  for (let i = 0; i < 20; i++) {
    const w = makeWorld();
    const human: Message = { id: `m_h_named${i}`, channelId: "c_general", authorId: "u_elias", content: "@Mara are you coming later?", createdAt: T0, isHuman: true };
    w.recent.get("c_general")!.push(human);
    const p = new Planner(w, initialPlannerState(T0));
    p.replyToHuman(human, T0);
    if (msgsOf(p.events).some((e) => e.message.authorId === "u_mara" && e.message.replyToId === human.id)) named++;
  }
  ok(named >= 16, `named NPC answers: Mara replied to "@Mara …" in ${named}/20 cases`);
  // Paused / muted: the server doesn't schedule while paused; muted NPCs never answer.
  const w = makeWorld({ muted: NPC_USERS.filter((u) => u.id !== "u_kemal").map((u) => u.id) });
  const human: Message = { id: "m_h_muted", channelId: "c_general", authorId: "u_elias", content: "@Mara you there?", createdAt: T0, isHuman: true };
  w.recent.get("c_general")!.push(human);
  const pm = new Planner(w, initialPlannerState(T0));
  for (let i = 0; i < 5; i++) pm.replyToHuman({ ...human, id: `m_h_muted${i}` }, T0);
  ok(msgsOf(pm.events).every((e) => e.message.authorId === "u_kemal") && pm.events.every((e) => e.kind !== "reaction" || !e.by || e.by === "u_kemal"), "muted NPCs never answer or react");
}

// 5b. 30 minutes of floor: style, bursts, typos, lore, callbacks
{
  const w = makeWorld();
  const state = initialPlannerState(T0);
  const events: FloorEvent[] = [];
  const MIN30 = 30 * 60_000;
  for (let now = T0; now <= T0 + MIN30; now += 4000) {
    const p = new Planner(w, state);
    p.advance(now, now + 12_000);
    events.push(...p.events);
  }
  const ms = msgsOf(events).filter((e) => e.message.createdAt <= T0 + MIN30);
  const m = ms.map((e) => e.message);
  const en = m.map((x) => x.i18n!.en);
  const groups = new Map<string, number>();
  for (const e of ms) if (e.group && e.message.simTag !== "fix") groups.set(e.group, (groups.get(e.group) ?? 0) + 1);
  const bursts = [...groups.values()].filter((n) => n >= 2).length;
  ok(bursts >= 5 && [...groups.values()].every((n) => n <= 3), `bursts: ${bursts} times someone sent 2–3 messages in a row (max 3)`);
  const fixes = m.filter((x) => x.simTag === "fix");
  const fixOk = fixes.every((f) => m.some((x) => x.authorId === f.authorId && x.simTag !== "fix" && f.createdAt - x.createdAt > 0 && f.createdAt - x.createdAt < 8000));
  ok(fixes.length >= 2 && fixOk, `typo corrections: ${fixes.length} (e.g. "${fixes[0]?.i18n?.en}"), each right after the typo`);
  const plain = (t: string) => t.replace(/@\w+/g, "").replace(/\b(IMAGEFORGE|SPOTLY|X100F)\b/g, "").replace(EMOJI_RE, "");
  const lower = en.filter((t) => plain(t) === plain(t).toLowerCase()).length / en.length;
  ok(lower >= 0.75, `lowercase share: ${Math.round(lower * 100)}%`);
  const avgLen = en.reduce((n, t) => n + t.length, 0) / en.length;
  const long = en.filter((t) => t.length > 100).length / en.length;
  ok(avgLen <= 45 && long < 0.03, `message length: avg ${avgLen.toFixed(1)} chars, ${(long * 100).toFixed(1)}% over 100`);
  const emojiShare = (id: string) => {
    const mine = m.filter((x) => x.authorId === id && x.simTag !== "fix");
    return mine.length ? mine.filter((x) => new RegExp(EMOJI_RE.source, "u").test(x.i18n!.en)).length / mine.length : 0;
  };
  const noEmoji = ["u_noor", "u_theo"].every((id) => emojiShare(id) === 0);
  const loud = (["u_ben", "u_mara", "u_pia"].map(emojiShare).reduce((n, x) => n + x, 0) / 3);
  ok(noEmoji && loud > 0.25, `emoji follow the persona: Noor/Theo never, Ben/Mara/Pia ${Math.round(loud * 100)}% of messages`);
  const slang = m.filter((x) => {
    const p = PERSONALITIES[x.authorId];
    return p?.slang.en.some((s) => {
      const core = s.replace(/[…—().,:!?]/g, "").trim().toLowerCase();
      return core.length > 2 && x.i18n!.en.toLowerCase().includes(core);
    });
  }).length;
  ok(slang / m.length > 0.08, `persona slang in ${Math.round((slang / m.length) * 100)}% of messages`);
  const reactedInstead = events.filter((e) => e.kind === "reaction" && e.instead).length;
  ok(reactedInstead > 0, `NPCs reacting to each other instead of replying: ${reactedInstead}`);
  // Running gags come back, from different people, spread over time.
  const lore = new Map<string, Message[]>();
  for (const x of m) if (x.simTag?.startsWith("lore:")) (lore.get(x.simTag) ?? lore.set(x.simTag, []).get(x.simTag)!).push(x);
  const recurring = [...lore.entries()].filter(([, xs]) => new Set(xs.map((x) => x.authorId)).size >= 2 && Math.max(...xs.map((x) => x.createdAt)) - Math.min(...xs.map((x) => x.createdAt)) > 5 * 60_000);
  ok(
    recurring.length >= 1 && lore.size >= 3,
    `recurring jokes: ${[...lore.entries()].map(([k, xs]) => `${k.slice(5)} ×${xs.length}`).join(", ")} — ${recurring.length} came back from different people >5 min apart`,
  );
  // Callbacks quote something that was really said earlier.
  const callbacks = m.filter((x) => x.simTag === "callback" && x.i18n!.en.includes('"'));
  const quoted = callbacks.filter((x) => {
    const q = x.i18n!.en.match(/"([^"]+)"/)?.[1]?.replace(/…$/, "").toLowerCase();
    const all = [...w.recent.values()].flat();
    return !!q && all.some((y) => y.createdAt < x.createdAt && (y.i18n?.en ?? y.content).toLowerCase().replace(/["“”„*@]/g, "").replace(/\s+/g, " ").includes(q.split(" ").slice(0, 3).join(" ")));
  });
  for (const x of callbacks) if (!quoted.includes(x)) console.log("unquoted:", x.i18n!.en);
  ok(callbacks.length >= 1 && quoted.length === callbacks.length, `callbacks to earlier lines: ${callbacks.length} (e.g. "${callbacks[0]?.i18n?.en}")`);
  // Friends back each other up.
  ok(m.some((x) => x.simTag === "friend"), `friends reply to friends: ${m.filter((x) => x.simTag === "friend").length} lines`);
  // No duplicate lines within any 150-message stretch.
  let dups = 0;
  const keys = en.map((t) => fingerprint(t));
  const dupTexts: string[] = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < Math.min(keys.length, i + 150); j++) if (keys[i]!.length > 3 && keys[i] === keys[j]) dups++, dupTexts.push(`${m[i]!.authorId}:${m[i]!.simTag}:${en[i]} / ${m[j]!.authorId}:${m[j]!.simTag}`);
  if (dupTexts.length) console.log(dupTexts.slice(0, 12).join("\n"));
  ok(dups === 0, `30 minutes, ${m.length} messages: ${dups} duplicate lines within any 150-message stretch`);
  // Typing: by the persona's speed — longer lines take longer.
  const typing = ms.filter((e) => e.message.simTag !== "fix").map((e) => [e.message.i18n!.en.length, e.typingMs] as const);
  const shortT = typing.filter(([l]) => l < 20).map(([, t]) => t);
  const longT = typing.filter(([l]) => l > 50).map(([, t]) => t);
  const mean = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);
  ok(typing.every(([, t]) => t >= 600 && t <= 12_000) && mean(longT) > 2 * mean(shortT), `typing 0.6–12 s, short lines ${(mean(shortT) / 1000).toFixed(1)} s vs long ${(mean(longT) / 1000).toFixed(1)} s`);
}

// 5c. rivals bicker with drama, not without
{
  const bick = (drama: number) => {
    const w = makeWorld({ drama });
    const lines = run(w, 900_000).msgs.filter((x) => x.simTag === "bicker");
    const all = [...w.recent.values()].flat();
    const rivals = lines.filter((x) => {
      const parent = all.find((y) => y.id === x.replyToId);
      return !!parent && (PERSONALITIES[x.authorId]!.rivals.includes(parent.authorId) || !!PERSONALITIES[parent.authorId]?.rivals.includes(x.authorId));
    });
    return { lines, rivals };
  };
  const calm = bick(0);
  const messy = bick(100);
  ok(calm.lines.length === 0 && messy.lines.length >= 3, `rivals bicker: ${calm.lines.length} lines at drama 0, ${messy.lines.length} at drama 100 (e.g. "${messy.lines[0]?.i18n?.en}")`);
  ok(messy.rivals.length >= messy.lines.length * 0.6, `bickering is between rivals: ${messy.rivals.length} of ${messy.lines.length}`);
}

// 5d. presence follows active hours (Hamburg time)
{
  const NIGHT = Date.UTC(2026, 10, 7, 2, 30); // 03:30 in Hamburg
  const w = makeWorld({}, NIGHT);
  const night = run(w, 600_000, NIGHT).msgs;
  const users = [...w.users.values()].filter((u) => u.isNpc);
  const away = users.filter((u) => u.presence === "offline" || u.presence === "idle").length / users.length;
  const online = users.filter((u) => u.presence === "online").map((u) => u.displayName);
  ok(away >= 0.6 && online.length >= 2, `03:30: ${Math.round(away * 100)}% idle/offline, still online: ${online.join(", ")}`);
  const sleepers = night.filter((x) => presenceTarget(x.authorId, x.createdAt) === "offline").length;
  ok(sleepers / Math.max(1, night.length) <= 0.1, `03:30: ${night.length} messages, ${sleepers} from people who should be asleep`);
  const day = makeWorld({}, T0);
  run(day, 600_000);
  const dayOnline = [...day.users.values()].filter((u) => u.isNpc && (u.presence === "online" || u.presence === "dnd")).length / users.length;
  ok(dayOnline >= 0.45, `21:30: ${Math.round(dayOnline * 100)}% online`);
  const always = users.filter((u) => PERSONALITIES[u.id]?.alwaysOn).every((u) => u.presence !== "offline");
  ok(always, "always-on people never go offline at night");
}

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
