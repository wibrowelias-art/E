/**
 * pnpm smoke — interaction checks for the Phase 1 shell (needs `pnpm dev` running).
 * Send with Enter, Shift+Enter newline, ↑ edits own last message, Esc cancels,
 * reactions toggle, channel switch updates URL + placeholder, mobile back/forward.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

  const reaction = page.locator(".reaction").first();
  const before = await reaction.innerText();
  await reaction.click();
  ok((await reaction.innerText()) !== before, "reaction toggles count");

  await page.locator(".chanrow", { hasText: "hamburg-night" }).first().click();
  await page.waitForTimeout(400);
  ok(new URL(page.url()).pathname === "/channels/lounge/hamburg-night", "channel switch updates URL");
  ok((await page.locator(".composer__input").getAttribute("placeholder")) === "Message #hamburg-night", "placeholder follows channel");

  await page.locator(".msg__name").first().click();
  ok(await page.locator(".popout").isVisible(), "profile popout opens");
  await page.keyboard.press("Escape");
  ok((await page.locator(".popout").count()) === 0, "Esc closes popout");

  // Language switch: gear → Deutsch → UI + backlog switch, back to English.
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

  // Backstage: opens from the title bar, sliders + preset + reset persist.
  await page.locator('.titlebar [aria-label="Backstage"]').click();
  ok(await page.locator(".bs").isVisible(), "Backstage opens");
  await page.locator(".bs-preset", { hasText: "Roast night" }).click();
  ok((await page.locator(".bs-slider__value").nth(1).innerText()) === "15%", "preset sets glaze ratio");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lounge.sim") ?? "{}"));
  ok(stored.glaze === 15 && stored.activity === 1.6, "settings persist in localStorage");
  await page.locator(".bs-reset").click();
  ok((await page.locator(".bs-preset[data-active=true]").innerText()).includes("Default vibe"), "reset → Default vibe active");
  await page.keyboard.press("Escape");
  ok((await page.locator(".bs").count()) === 0, "Esc closes Backstage");

  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
