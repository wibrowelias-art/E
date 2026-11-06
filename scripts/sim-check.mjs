/**
 * pnpm sim:check — acceptance tests for the stub simulator, run against a live
 * server with Playwright's fake clock (5 simulated minutes take a few seconds).
 *
 *  1. Cold open #general: ≥3 NPC messages and ≥1 reply within 15s
 *  2. 5 minutes: ≥40 new messages across channels, <2 near-duplicate pairs
 *  3. ≥10 messages reference Elias / The Lounge, but not all of them
 *  5. No API key → stub mode still alive (this whole script)
 *  + Backstage sliders measurably change the output; English mode has no German.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { loginOwner } from "./env.mjs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

const GERMAN = /\b(ich|und|nicht|ist|das|der|wer|bin|heute|mit|auch|aber|kein|keine|noch|schon|jetzt|wir|ihr|bitte|haben|gerade|sind|wieder|für|über|eine|einen|sehr|nach|weil|gibt|hab|dass|oder|warum|wie|euch|dich|mich)\b/i;
const tokens = (t) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
function nearDupPairs(texts) {
  let pairs = 0;
  const sets = texts.map(tokens);
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i], b = sets[j];
      if (a.size < 3 || b.size < 3) continue;
      let inter = 0;
      for (const w of a) if (b.has(w)) inter++;
      if (inter / (a.size + b.size - inter) >= 0.8) pairs++;
    }
  return pairs;
}

async function session(browser, settings) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginOwner(ctx, BASE);
  if (settings) await ctx.addInitScript((s) => localStorage.setItem("lounge.sim", JSON.stringify(s)), settings);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-11-06T21:30:00") });
  // local=1 keeps simulator test runs out of the database
  await page.goto(`${BASE}/channels/lounge/general?debug&lang=en&local=1`, { waitUntil: "networkidle" });
  // Advance the fake clock in small steps until the app has hydrated.
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(() => !!window.__lounge?.getState().ready)) break;
    await page.clock.runFor(50);
    await page.waitForTimeout(20);
  }
  const sim = () =>
    page.evaluate(() =>
      window.__lounge
        .getState()
        .messages.filter((m) => m.id.startsWith("m_sim_"))
        .map((m) => ({ ch: m.channelId, en: m.i18n.en, tag: m.simTag, reply: !!m.replyToId, author: m.authorId })),
    );
  return { page, ctx, sim };
}

const DEFAULT = { activity: 1, glaze: 65, drama: 20, prompt: "Talk about plans for tonight, film photos, music, food and Elias' latest drops. Be friendly, a little teasing, specific with compliments.", liveReplies: false, breakCharacter: false, paused: false };

const browser = await chromium.launch();
try {
  // 1 + 2 + 3 with the default vibe
  const s = await session(browser, null);
  await s.page.clock.runFor(15_000);
  const first = await s.sim();
  const general = first.filter((m) => m.ch === "c_general");
  ok(general.length >= 3, `cold open: ${general.length} NPC messages in #general within 15s (≥3)`);
  ok(general.some((m) => m.reply), "cold open: at least one reply chain");

  await s.page.clock.runFor(285_000);
  const five = await s.sim();
  ok(five.length >= 40, `5 minutes: ${five.length} new messages across ${new Set(five.map((m) => m.ch)).size} channels (≥40)`);
  const dups = nearDupPairs(five.map((m) => m.en));
  ok(dups < 2, `near-duplicate pairs: ${dups} (<2)`);
  const elias = five.filter((m) => /elias|lounge|imageforge|spotly/i.test(m.en)).length;
  ok(elias >= 10 && elias < five.length, `Elias/Lounge references: ${elias} of ${five.length} (≥10, not all)`);
  ok(five.filter((m) => m.reply).length / five.length >= 0.35, `reply share: ${Math.round((five.filter((m) => m.reply).length / five.length) * 100)}%`);
  let maxRun = 0;
  for (const ch of new Set(five.map((m) => m.ch))) {
    let run = 0, prev = "";
    for (const m of five.filter((x) => x.ch === ch)) {
      run = m.author === prev ? run + 1 : 1;
      prev = m.author;
      maxRun = Math.max(maxRun, run);
    }
  }
  ok(maxRun <= 2, `max posts in a row by one NPC: ${maxRun} (≤2)`);
  const german = five.filter((m) => GERMAN.test(m.en.replace(/@\w+/g, "")));
  ok(german.length === 0, `English mode: ${german.length} generated lines with German words`);
  await s.ctx.close();

  // Backstage sliders change the output
  const run = async (patch, ms = 180_000) => {
    const x = await session(browser, { ...DEFAULT, ...patch });
    await x.page.clock.runFor(ms);
    const out = await x.sim();
    await x.ctx.close();
    return out;
  };
  const share = (msgs, tags) => msgs.filter((m) => tags.includes(m.tag)).length / Math.max(1, msgs.length);

  const sleepy = await run({ activity: 0.25 });
  const chaos = await run({ activity: 3 });
  ok(chaos.length > sleepy.length * 4, `activity: sleepy ${sleepy.length} vs chaos ${chaos.length} messages in 3 min`);

  const hate = await run({ glaze: 0 });
  const worship = await run({ glaze: 100 });
  const pos = (m) => share(m, ["worship", "praise", "ownerPos"]);
  const neg = (m) => share(m, ["roast", "critical", "ownerNeg"]);
  ok(neg(hate) > 0.15 && pos(hate) === 0, `glaze 0%: ${Math.round(neg(hate) * 100)}% roast/critical, ${Math.round(pos(hate) * 100)}% praise`);
  ok(pos(worship) > 0.15 && neg(worship) === 0, `glaze 100%: ${Math.round(pos(worship) * 100)}% worship/praise, ${Math.round(neg(worship) * 100)}% roast`);

  const calm = await run({ drama: 0 }, 300_000);
  const messy = await run({ drama: 100 }, 300_000);
  ok(share(messy, ["drama", "disagree"]) > share(calm, ["drama", "disagree"]) * 3, `drama: ${Math.round(share(calm, ["drama", "disagree"]) * 100)}% at 0 → ${Math.round(share(messy, ["drama", "disagree"]) * 100)}% at 100`);

  const prompted = await run({ prompt: "Talk about the rooftop party on Friday and vintage cameras. Be hyped." });
  const hits = prompted.filter((m) => /rooftop party on friday|vintage cameras/i.test(m.en)).length;
  ok(hits >= 3, `vibe prompt: ${hits} lines about the prompt topics`);

  const meta = await run({ breakCharacter: true, activity: 2 });
  ok(meta.some((m) => m.tag === "meta"), "break character on → meta lines appear");
  ok(!worship.some((m) => m.tag === "meta"), "break character off → no meta lines");

  const paused = await run({ paused: true }, 60_000);
  ok(paused.length === 0, `paused: ${paused.length} messages in 1 min`);
} finally {
  await browser.close();
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
