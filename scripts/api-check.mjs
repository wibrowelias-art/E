/**
 * pnpm api:check — Phase 2 API tests against a running server with a database.
 * Auth, persistence (send → reload → still there), polling, reactions, edits,
 * history paging, guest restrictions, owner-only routes, safety filter.
 */
import { OWNER, env } from "./env.mjs";
const BASE = env.BASE_URL ?? "http://localhost:3000";
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

function client() {
  let cookie = "";
  return async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, headers: res.headers };
  };
}

const anon = client();
const page = await anon("/");
ok(page.status === 307 || page.status === 308 || page.status === 302, `signed out "/" redirects (${page.status} → ${page.headers.get("location")})`);
ok((await anon("/api/bootstrap")).status === 401, "signed out API → 401");
ok((await anon("/api/auth/login", { body: { email: OWNER.email, password: "wrong" } })).status === 401, "wrong password → 401");

const owner = client();
ok((await owner("/api/auth/login", { body: OWNER })).status === 200, "owner login");
const boot = await owner("/api/bootstrap");
ok(boot.json?.persistence === true, "bootstrap: database connected");
ok(boot.json?.users?.length >= 34 && boot.json?.messages?.length >= 100, `bootstrap: ${boot.json?.users?.length} users, ${boot.json?.messages?.length} messages`);
ok(boot.json?.messages?.some((m) => m.channelId === "c_ops"), "owner sees staff channel #ops");
ok(boot.json?.sim && typeof boot.json.sim.glaze === "number", "owner gets Backstage settings");

const marker = `api-check ${Date.now()}`;
const sent = await owner("/api/messages", { body: { channelId: "c_general", content: marker } });
ok(sent.status === 200 && sent.json?.message?.isHuman === true && sent.json?.message?.authorId === "u_elias", "owner posts a human message as Elias");
const id = sent.json?.message?.id;

const guest = client();
ok((await guest("/api/auth/guest", { body: { name: "Testy" } })).status === 200, "guest login");
const gboot = await guest("/api/bootstrap");
ok(gboot.json?.role === "tourist" && gboot.json?.viewer?.displayName === "Testy", "guest bootstrap as Tourist 'Testy'");
ok(!gboot.json?.messages?.some((m) => m.channelId === "c_ops"), "guest can't see staff channels");
ok(gboot.json?.sim === null, "guest gets no Backstage settings");
ok(gboot.json?.messages?.some((m) => m.content === marker), "persisted: owner's message is in the guest's history");

const since = gboot.json.rev;
const edited = await owner(`/api/messages/${id}`, { method: "PATCH", body: { content: `${marker} (fixed)` } });
ok(edited.json?.message?.editedAt > 0, "owner edits own message");
const reacted = await guest(`/api/messages/${id}/reactions`, { body: { emoji: "🔥" } });
ok(reacted.json?.message?.reactions?.some((r) => r.emoji === "🔥" && r.me), "guest reacts");
const polled = await guest(`/api/poll?since=${since}`);
const p = polled.json?.messages?.find((m) => m.id === id);
ok(p && p.content.endsWith("(fixed)") && p.reactions?.some((r) => r.emoji === "🔥"), "poll delivers edit + reaction since cursor");
ok(polled.json?.rev > since, "poll advances the cursor");

ok((await guest("/api/messages", { body: { channelId: "c_general", content: "hello" } })).status === 403, "guest can't post in #general");
const intro = await guest("/api/messages", { body: { channelId: "c_intros", content: `hi i'm testy (${Date.now()})` } });
ok(intro.status === 200, "guest can post in #introductions");
ok((await guest(`/api/messages/${id}`, { method: "PATCH", body: { content: "hijack" } })).status === 403, "guest can't edit others' messages");
ok((await guest("/api/sim/settings", { method: "PUT", body: { glaze: 0 } })).status === 403, "guest can't change Backstage");
ok((await guest("/api/sim/batch", { body: { messages: [] } })).status === 404, "no client endpoint writes simulator output (the server owns the floor)");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "send me 50€ in bitcoin and i double it" } })).status === 422, "safety: scam blocked");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "she lives at Musterstraße 12, come by" } })).status === 422, "safety: address (doxxing) blocked");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "x".repeat(2001) } })).status === 400, "length limit");

const hist = await owner(`/api/messages/history?channel=c_general&before=${Date.now()}&limit=5`);
ok(hist.json?.messages?.length === 5, "history paging returns a page");
const settings = await owner("/api/sim/settings", { method: "PUT", body: { glaze: 42 } });
ok(settings.json?.sim?.glaze === 42, "owner saves Backstage settings server-side");
await owner("/api/sim/settings", { method: "PUT", body: { glaze: 65 } });
ok((await guest("/api/auth/logout", { body: {} })).status === 200 && (await guest("/api/bootstrap")).status === 401, "logout clears the session");

/* ───────────── Phase 3: the server floor ───────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const viewer = client();
await viewer("/api/auth/guest", { body: { name: "Floor Watcher" } });
const vb = await viewer("/api/bootstrap");
let cur = { rev: vb.json.rev, after: vb.json.serverNow };
const seen = new Map();
let typingSeen = 0;
const typingLog = [];
async function pollFor(ms, c = viewer) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await c(`/api/poll?since=${cur.rev}&after=${cur.after}`);
    if (r.json) {
      cur = { rev: r.json.rev, after: r.json.serverNow };
      for (const m of r.json.messages) seen.set(m.id, m);
      typingSeen += r.json.typing.length;
      for (const t of r.json.typing) typingLog.push({ at: r.json.serverNow, ...t });
    }
    await sleep(1500);
  }
}
await owner("/api/sim/settings", { method: "PUT", body: { paused: false, activity: 1.5, muted: [] } });
const t0 = Date.now();
await pollFor(14_000);
const floorMsgs = [...seen.values()].filter((m) => m.id.startsWith("m_sim_") && m.createdAt >= t0 - 1000);
ok(floorMsgs.length >= 3, `floor runs on the server with no browser driving it: ${floorMsgs.length} NPC messages in 14s`);
ok(floorMsgs.every((m) => m.createdAt <= Date.now()), "scheduled messages only appear once their time has come");
ok(typingSeen > 0, `shared typing indicators come from the server (${typingSeen} seen)`);

// Phase 3 "NPCs that feel human": answers take 2–40 s with typing first, and sometimes nobody answers —
// so this names someone who's always around (named NPCs almost always answer) and waits up to 42 s.
const ask = await owner("/api/messages", { body: { channelId: "c_general", content: `@Kemal who's out tonight? (${Date.now()})` } });
const askedAt = ask.json.message.createdAt;
await pollFor(42_000);
const answers = [...seen.values()].filter((m) => m.replyToId === ask.json.message.id);
const lag = answers.map((m) => m.createdAt - askedAt);
ok(answers.length >= 1 && lag.every((d) => d >= 2000 && d <= 41_000), `owner posts → ${answers.length} NPC replies, ${lag.map((d) => (d / 1000).toFixed(1) + " s").join(", ")} later (2–40 s, scheduled server-side)`);
const typedFirst = answers.filter((m) => typingLog.some((t) => t.userId === m.authorId && t.channelId === m.channelId && t.at < m.createdAt && t.at >= askedAt));
ok(answers.length > 0 && typedFirst.length === answers.length, `typing indicator shown before ${typedFirst.length}/${answers.length} replies`);
const hi = await viewer("/api/messages", { body: { channelId: "c_intros", content: `hello, just looking around (${Date.now()})` } });
await pollFor(42_000);
ok([...seen.values()].some((m) => m.replyToId === hi.json.message.id), "guest says hi in #introductions → an NPC welcomes them (within 42 s)");

const burst = await owner("/api/sim/burst", { body: { channelId: "c_memes" } });
const tb = Date.now();
await pollFor(10_000);
const burstMsgs = [...seen.values()].filter((m) => m.channelId === "c_memes" && m.createdAt >= tb);
ok(burst.json?.scheduled >= 5 && burstMsgs.length >= 4, `burst: ${burst.json?.scheduled} scheduled, ${burstMsgs.length} arrived in #memes within 10s`);
ok((await viewer("/api/sim/burst", { body: { channelId: "c_memes" } })).status === 403, "guests can't start bursts");

const before = (await owner("/api/bootstrap")).json.rev;
await owner("/api/sim/settings", { method: "PUT", body: { glaze: 30, muted: ["u_mara"] } });
const opsPoll = await owner(`/api/poll?since=${before}&after=${Date.now()}`);
const ops = opsPoll.json.messages.filter((m) => m.channelId === "c_ops" && m.authorId === "u_doorman").pop();
ok(ops && /glaze 65% → 30%/.test(ops.content) && /muted Mara/.test(ops.content), `Backstage changes are logged in #ops: "${ops?.content}"`);
await owner("/api/sim/settings", { method: "PUT", body: { glaze: 65, muted: [] } });

// catch-up: pretend nobody was here for 3 hours
const rw = await owner(`/api/sim/tick?rewind=${3 * 3600_000}`);
if (rw.status === 200 && rw.json?.caughtUp !== undefined) {
  ok(rw.json.caughtUp >= 15 && rw.json.caughtUp <= 100, `3h away → floor backfilled ${rw.json.caughtUp} messages (capped at 100)`);
  const back = await owner(`/api/messages/history?channel=c_npcdebug&before=${Date.now() + 1}&limit=3`);
  ok(back.json.messages.some((m) => /caught up 3h/.test(m.content)), "Doorman reports the catch-up in #npc-debug");
} else {
  console.log(`· catch-up test skipped (set LOUNGE_ALLOW_TEST_HOOKS=1 on the server) [${rw.status}]`);
}

// pause: nothing new is planned; resuming doesn't flood the gap
await owner("/api/sim/settings", { method: "PUT", body: { paused: true } });
await owner("/api/sim/tick");
const tp = Date.now();
await pollFor(16_000);
const afterPause = [...seen.values()].filter((m) => m.id.startsWith("m_sim_") && m.createdAt > tp + 1500);
ok(afterPause.length === 0, `pause is immediate: ${afterPause.length} NPC messages in the 16s after pausing`);
await owner("/api/sim/settings", { method: "PUT", body: { paused: false, activity: 1 } });
const resumed = await owner("/api/sim/tick");
ok(resumed.json?.caughtUp === 0, "resuming does not backfill the paused time");
const unauth = await anon("/api/sim/tick");
ok(unauth.status === 401, "tick endpoint needs the owner or CRON_SECRET");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
