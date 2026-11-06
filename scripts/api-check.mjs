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
ok((await guest("/api/sim/batch", { body: { messages: [] } })).status === 403, "guest can't write simulator output");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "send me 50€ in bitcoin and i double it" } })).status === 422, "safety: scam blocked");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "she lives at Musterstraße 12, come by" } })).status === 422, "safety: address (doxxing) blocked");
ok((await owner("/api/messages", { body: { channelId: "c_general", content: "x".repeat(2001) } })).status === 400, "length limit");

const batch = await owner("/api/sim/batch", {
  body: {
    messages: [
      { id: `m_sim_check_${Date.now()}`, channelId: "c_general", authorId: "u_mara", content: "sim batch line", createdAt: Date.now() },
      { id: `m_sim_fake_${Date.now()}`, channelId: "c_general", authorId: "u_elias", content: "pretending to be elias", createdAt: Date.now() },
    ],
  },
});
ok(batch.json?.accepted === 1, "sim batch: NPC line accepted, line posing as Elias rejected");

const hist = await owner(`/api/messages/history?channel=c_general&before=${Date.now()}&limit=5`);
ok(hist.json?.messages?.length === 5, "history paging returns a page");
const settings = await owner("/api/sim/settings", { method: "PUT", body: { glaze: 42 } });
ok(settings.json?.sim?.glaze === 42, "owner saves Backstage settings server-side");
await owner("/api/sim/settings", { method: "PUT", body: { glaze: 65 } });
ok((await guest("/api/auth/logout", { body: {} })).status === 200 && (await guest("/api/bootstrap")).status === 401, "logout clears the session");

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
