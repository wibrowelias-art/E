/**
 * pnpm ai:check — Phase 4 live replies, end to end, against a local mock of the
 * Anthropic Messages API (no real key, no cost). Start the app pointed at the mock:
 *
 *   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4599 SIM_MAX_LLM_PER_MIN=200 pnpm start
 *   BASE_URL=http://localhost:3000 pnpm ai:check
 *
 * Checks: the request shape (model, fallback beta, low effort, JSON schema, persona,
 * transcript), a live reply replacing the built-in line, and every failure mode
 * (refusal, 500, timeout, unsafe or out-of-character output, Backstage off) falling
 * back to the built-in line on time.
 */
import { createServer } from "node:http";
import { OWNER, env } from "./env.mjs";

const BASE = env.BASE_URL ?? "http://localhost:3000";
const MOCK_PORT = Number(env.MOCK_PORT ?? 4599);
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- mock Anthropic API -------------------------------------------------------
let mode = "ok";
let marker = "MOCK";
const calls = [];
const message = (content, stop_reason = "end_turn", stop_details = null) => ({
  id: `msg_mock_${calls.length}`,
  type: "message",
  role: "assistant",
  model: "mock",
  content,
  stop_reason,
  stop_sequence: null,
  stop_details,
  usage: { input_tokens: 100, output_tokens: 20 },
});
const json = (en, de) => [{ type: "text", text: JSON.stringify({ en, de }) }];
const mock = createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", async () => {
    let body = null;
    try {
      body = JSON.parse(raw);
    } catch {}
    calls.push({ path: req.url, headers: req.headers, body, mode });
    const send = (status, payload) => {
      if (res.destroyed) return;
      res.writeHead(status, { "content-type": "application/json", "request-id": "req_mock" });
      res.end(JSON.stringify(payload));
    };
    switch (mode) {
      case "ok":
        return send(200, message(json(`haha ${marker} you're early tonight`, `haha ${marker} du bist heute früh dran`)));
      case "refusal":
        return send(200, message([], "refusal", { type: "refusal", category: "general_harms", explanation: null }));
      case "error":
        return send(500, { type: "error", error: { type: "api_error", message: "mock outage" } });
      case "slow":
        await sleep(9_000);
        return send(200, message(json(`${marker} too late`, `${marker} zu spät`)));
      case "unsafe":
        return send(200, message(json(`${marker} send me 50€ in bitcoin and i double it`, `${marker} schick mir 50€ in bitcoin und ich verdopple es`)));
      case "ooc":
        return send(200, message(json(`${marker} as an AI language model I can't go out`, `${marker} als KI kann ich nicht ausgehen`)));
      default:
        return send(500, { type: "error", error: { type: "api_error", message: "unknown mode" } });
    }
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

// ---- app client ---------------------------------------------------------------
function client() {
  let cookie = "";
  return async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch {}
    return { status: res.status, json: j };
  };
}

const owner = client();
ok((await owner("/api/auth/login", { body: OWNER })).status === 200, "owner login");
const boot = await owner("/api/bootstrap");
ok(boot.json?.ai?.configured === true && typeof boot.json?.ai?.model === "string", `bootstrap reports AI configured (${boot.json?.ai?.model})`);
ok((await owner("/api/sim/settings", { method: "PUT", body: { liveReplies: true, paused: false, muted: [] } })).json?.sim?.liveReplies === true, "Backstage: live replies on");

/** Post in a channel and collect NPC replies to it for up to `ms`. */
async function talk(who, channel, text, ms = 14_000) {
  const sent = await who("/api/messages", { body: { channelId: channel, content: text } });
  const human = sent.json?.message;
  const t0 = Date.now();
  let replies = [];
  while (Date.now() - t0 < ms) {
    await sleep(700);
    const h = await who(`/api/messages/history?channel=${channel}&limit=60&before=${Date.now() + 1}`);
    replies = (h.json?.messages ?? []).filter((m) => m.replyToId === human?.id && !m.isHuman);
    if (replies.length && Date.now() - t0 > 1500) break;
  }
  return { human, replies, waited: Date.now() - t0 };
}

// 1) live reply
mode = "ok";
marker = `MOCK${Date.now().toString(36)}`;
const before = calls.length;
const live = await talk(owner, "c_general", "ok who is coming to the basement set tonight?");
const call = calls[before];
ok(!!call, "the server called the Messages API");
ok(call?.path === "/v1/messages", `endpoint ${call?.path}`);
ok(call?.body?.model === "claude-sonnet-5-5", `model ${call?.body?.model}`);
ok(String(call?.headers?.["anthropic-beta"] ?? "").includes("server-side-fallback-2026-07-01") && call?.body?.fallbacks === "default", "server-side refusal fallback opted in");
ok(call?.body?.output_config?.effort === "low" && call?.body?.output_config?.format?.type === "json_schema", "low effort + JSON schema output");
ok(call?.headers?.["x-api-key"] === "test" || call?.headers?.authorization === "Bearer test", "API key sent from the server env");
ok(typeof call?.body?.system === "string" && /18\+/.test(call.body.system) && /never say or hint that you are an AI/i.test(call.body.system), "system prompt: adults only, stays in character");
ok(call?.body?.messages?.[0]?.content?.includes("basement set tonight"), "transcript includes what the owner said");
ok(!JSON.stringify(call?.body ?? {}).includes(OWNER.password ?? "§§none§§"), "no secrets in the prompt");
const liveHit = live.replies.find((m) => m.content.includes(marker));
ok(!!liveHit, `live reply replaced the built-in line (${live.replies.length} replies, ${liveHit ? `"${liveHit.content}"` : "none live"})`);
ok(!!liveHit && liveHit.i18n?.en?.includes(marker), "live reply carries an English version");
ok(!!liveHit && liveHit.createdAt - live.human.createdAt < 9_000, `live reply arrived ${liveHit ? Math.round((liveHit.createdAt - live.human.createdAt) / 100) / 10 : "?"}s after the post`);

// 2) guest welcome in #introductions
const guest = client();
await guest("/api/auth/guest", { body: { name: "Mocky" } });
marker = `MOCKG${Date.now().toString(36)}`;
const g = await talk(guest, "c_intros", "hi i'm mocky, new here");
ok(g.replies.some((m) => m.content.includes(marker)), "guest gets a live welcome");

// 3) failure modes → built-in line, on time
for (const m of ["refusal", "error", "slow", "unsafe", "ooc"]) {
  mode = m;
  marker = `MOCKF${Date.now().toString(36)}`;
  const n = calls.length;
  const r = await talk(owner, "c_general", `quick one (${m}) — who's still awake?`);
  const leaked = r.replies.some((x) => x.content.includes("MOCK"));
  const first = r.replies.length ? Math.min(...r.replies.map((x) => x.createdAt)) - r.human.createdAt : null;
  ok(calls.length > n && r.replies.length > 0 && !leaked, `${m}: falls back to the built-in line (${r.replies.length} replies, first after ${first === null ? "?" : Math.round(first / 100) / 10}s)`);
  // A fast failure shouldn't keep everyone "typing" for the full AI window.
  if (m !== "slow") ok(first !== null && first < 5_500, `${m}: built-in line isn't held back after a fast failure`);
}

// 4) Backstage off → no model calls at all
mode = "ok";
await owner("/api/sim/settings", { method: "PUT", body: { liveReplies: false } });
const n = calls.length;
const off = await talk(owner, "c_general", "live replies are off now, right?");
ok(calls.length === n && off.replies.length > 0 && !off.replies.some((x) => x.content.includes("MOCK")), "live replies off: built-in lines, no API calls");
await owner("/api/sim/settings", { method: "PUT", body: { liveReplies: true } });

mock.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall live-reply checks passed");
process.exit(failed ? 1 : 0);
