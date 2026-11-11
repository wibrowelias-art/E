/**
 * pnpm smoke — interaction checks for the Phase 1 shell (needs `pnpm dev` running).
 * Send with Enter, Shift+Enter newline, ↑ edits own last message, Esc cancels,
 * reactions toggle, channel switch updates URL + placeholder, mobile back/forward.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { OWNER, loginOwner } from "./env.mjs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

const browser = await chromium.launch();
try {
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ownerCtx.newPage();
  // Phase 2: the door — signed-out visitors land on /login, owner signs in through the form.
  await page.goto(`${BASE}/channels/lounge/general`, { waitUntil: "networkidle" });
  ok(new URL(page.url()).pathname === "/login", "signed out → /login");
  await page.fill("#email", OWNER.email);
  await page.fill("#password", "definitely-wrong");
  await page.click(".auth__primary");
  await page.waitForSelector(".auth__error");
  ok(true, "wrong password shows an error");
  await page.fill("#password", OWNER.password);
  await page.click(".auth__primary");
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
  ok(true, "owner signs in through the form");
  // The server floor would post into the channels under test — pause it for the UI checks.
  await ownerCtx.request.put(`${BASE}/api/sim/settings`, { data: { paused: true } });
  await page.waitForTimeout(13_000); // let already-scheduled lines (12s lookahead) land
  await page.goto(`${BASE}/channels/lounge/general?sim=off&lang=en`, { waitUntil: "networkidle" });
  await page.waitForSelector(".msg");
  ok(await page.locator(".skel").count() === 0, "skeleton replaced by messages after hydration");
  const input = page.locator(".composer__input");
  ok((await input.getAttribute("placeholder")) === "Message #general", 'placeholder "Message #general"');

  await input.click();
  await input.type("first line");
  await input.press("Shift+Enter");
  await input.type("second line");
  await input.press("Enter");
  await page.waitForTimeout(300);
  const last = page.locator(".msg").last();
  ok((await last.innerText()).includes("first line\nsecond line"), "Enter sends, Shift+Enter keeps newline");
  ok((await input.inputValue()) === "", "composer cleared after send");
  await page.waitForFunction(() => !document.querySelector(".msg[data-pending]"), null, { timeout: 10000 });
  ok(true, "message confirmed by the server (pending cleared)");

  await input.press("ArrowUp");
  await page.waitForSelector(".editbox textarea");
  ok(true, "↑ opens edit on own last message");
  await page.keyboard.press("Escape");
  ok((await page.locator(".editbox").count()) === 0, "Esc cancels edit");
  await input.press("ArrowUp");
  const edit = page.locator(".editbox textarea");
  await edit.fill("edited text");
  await edit.press("Enter");
  await page.waitForTimeout(200);
  ok((await page.locator(".msg").last().innerText()).includes("edited text(edited)"), "edit saves with (edited) marker");
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".msg");
  ok((await page.locator(".msg").last().innerText()).includes("edited text(edited)"), "after reload: the message and its edit are still there (persisted)");

  // React from the hover toolbar, then toggle it off again from the chip.
  const lastMsg = page.locator(".msg").last();
  await lastMsg.hover();
  await lastMsg.locator(".quick-react").first().click();
  const reaction = lastMsg.locator(".reaction:not(.reaction--add)").first();
  await reaction.waitFor();
  ok((await reaction.getAttribute("data-me")) === "true", "hover toolbar adds a reaction");
  await reaction.click();
  await page.waitForTimeout(200);
  ok((await lastMsg.locator(".reaction:not(.reaction--add)").count()) === 0, "reaction toggles off again");

  await page.locator(".chanrow", { hasText: "hamburg-night" }).first().click();
  await page.waitForTimeout(400);
  ok(new URL(page.url()).pathname === "/channels/lounge/hamburg-night", "channel switch updates URL");
  ok((await page.locator(".composer__input").getAttribute("placeholder")) === "Message #hamburg-night", "placeholder follows channel");

  await page.locator(".msg__name").first().click();
  ok(await page.locator(".popout").isVisible(), "profile popout opens");
  await page.keyboard.press("Escape");
  ok((await page.locator(".popout").count()) === 0, "Esc closes popout");

  // Language switch: gear → Deutsch → UI + backlog switch, back to English.
  // (checked on the fixed local backlog — the live database history keeps moving)
  await page.goto(`${BASE}/channels/lounge/hamburg-night?sim=off&lang=en&local=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".msg");
  await page.locator(".upanel .iconbtn").last().click();
  await page.locator(".smenu__item", { hasText: "Deutsch" }).click();
  await page.waitForTimeout(200);
  ok((await page.locator(".composer__input").getAttribute("placeholder")) === "Nachricht an #hamburg-night", "Deutsch: UI strings switch");
  ok((await page.locator(".msglist").innerText()).includes("komme grad aus der nachtschicht"), "Deutsch: backlog shows the Hamburg mix");
  await page.locator(".smenu__item", { hasText: "English" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const english = await page.locator(".msglist").innerText();
  ok(english.includes("just got off night shift") && !english.includes("nachtschicht"), "English: backlog fully English");

  // Backstage: opens from the chat header, sliders + preset + reset persist.
  await page.locator('.chat-head [aria-label="Backstage"]').click();
  ok(await page.locator(".bs").isVisible(), "Backstage opens");
  await page.locator(".bs-preset", { hasText: "Roast night" }).click();
  ok((await page.locator(".bs-slider__value").nth(1).innerText()) === "15%", "preset sets glaze ratio");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lounge.sim") ?? "{}"));
  ok(stored.glaze === 15 && stored.activity === 1.6, "settings persist in localStorage");
  await page.locator(".bs-reset").click();
  ok((await page.locator(".bs-preset[data-active=true]").innerText()).includes("Default vibe"), "reset → Default vibe active");
  await page.keyboard.press("Escape");
  ok((await page.locator(".bs").count()) === 0, "Esc closes Backstage");

  // Guest (Tourist): read-mostly
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const g = await guestCtx.newPage();
  await g.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await g.fill(".auth__guest input", "Smoke Guest");
  await g.click(".auth__secondary");
  await g.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
  await g.goto(`${BASE}/channels/lounge/general?sim=off&lang=en&debug`, { waitUntil: "networkidle" });
  await g.waitForSelector(".msg");
  ok(await g.locator(".composer__readonly").isVisible(), "guest: #general composer is read-only");
  ok((await g.locator('.chat-head [aria-label="Backstage"]').count()) === 0, "guest: no Backstage button");
  ok((await g.locator(".chanrow", { hasText: "ops" }).count()) === 0, "guest: staff channels hidden");
  await g.locator(".chanrow", { hasText: "introductions" }).first().click();
  const gi = g.locator(".composer__input");
  await gi.click();
  await gi.type(`hi from the smoke test ${Date.now()}`);
  await gi.press("Enter");
  await g.waitForFunction(() => !document.querySelector(".msg[data-pending]") && !document.querySelector(".msg[data-failed]"), null, { timeout: 10000 });
  ok(true, "guest: can post in #introductions");

  // Phase 3: the floor runs on the server — no owner page open, the guest still sees it move.
  await page.close();
  await ownerCtx.request.put(`${BASE}/api/sim/settings`, { data: { paused: false, activity: 2 } });
  await g.locator(".chanrow", { hasText: "general" }).first().click();
  await g.waitForTimeout(500);
  await ownerCtx.request.post(`${BASE}/api/sim/burst`, { data: { channelId: "c_general" } });
  const floorCount = () =>
    g.evaluate(() => window.__lounge.getState().messages.filter((m) => m.id.startsWith("m_sim_") && m.channelId === "c_general").length);
  const startCount = await floorCount();
  let arrived = 0;
  let sawTyping = false;
  for (let i = 0; i < 50 && (arrived < 2 || !sawTyping); i++) {
    await g.waitForTimeout(400);
    arrived = (await floorCount()) - startCount;
    sawTyping ||= (await g.locator(".typing b").count()) > 0;
  }
  ok(arrived >= 2, `guest watches the server floor live with no owner online (+${arrived} NPC messages)`);
  ok(sawTyping, "guest sees typing indicators from the server floor");
  await ownerCtx.request.put(`${BASE}/api/sim/settings`, { data: { activity: 1 } });

  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await loginOwner(mctx, BASE);
  const m = await mctx.newPage();
  await m.goto(`${BASE}/?sim=off&lang=en`, { waitUntil: "networkidle" });
  await m.waitForSelector(".msg");
  ok((await m.locator(".app").getAttribute("data-pane")) === "channels", "mobile opens on channel list");
  await m.locator(".chanrow", { hasText: "glaze" }).first().tap();
  await m.waitForTimeout(400);
  ok((await m.locator(".app").getAttribute("data-pane")) === "chat", "tap channel → chat pane");
  await m.locator(".mchat-head__back").tap();
  await m.waitForTimeout(400);
  ok((await m.locator(".app").getAttribute("data-pane")) === "channels", "back → channel list");
} finally {
  await browser.close();
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
