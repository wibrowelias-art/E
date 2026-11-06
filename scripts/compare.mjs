/**
 * pnpm shots — renders every screen and builds CURRENT vs REFERENCE sheets.
 *
 *   BASE_URL=http://localhost:3000 pnpm shots
 *
 * Output: docs/screenshots/*.png
 *  - mobile-channels.compare.png  REFERENCE | CURRENT | 50% overlay | difference
 *  - *.current.png                screens without a reference (desktop, tablet, mobile chat)
 *
 * The reference was captured on a 430pt-wide iPhone (status-bar glyph sizes
 * prove the scale), so the matching viewport is 430×932 @ 2.977x with the iOS
 * safe-area insets simulated via ?frame=ios.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("docs/screenshots");
const REF = path.resolve("docs/reference/mobile-channels.jpg");
mkdirSync(OUT, { recursive: true });

const settle = async (page) => {
  await page.waitForFunction(() => document.querySelector(".msg") && document.querySelector(".chanrow"), null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
};

async function shot(browser, name, url, viewport, dpr, prep) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: viewport.width < 768 });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await settle(page);
  if (prep) await prep(page);
  const file = path.join(OUT, `${name}.current.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  return file;
}

async function compareSheet(browser, name, currentFile, referenceFile, w, h) {
  const b64 = (f) => readFileSync(f).toString("base64");
  const refMime = referenceFile.endsWith(".jpg") ? "image/jpeg" : "image/png";
  const cw = 430; // CSS width of each column
  const ch = Math.round((h / w) * cw);
  const html = `<html><body style="margin:0;background:#000;font:600 14px system-ui;color:#fff">
    <div style="display:flex;gap:12px;padding:12px">
      ${[
        ["REFERENCE", `<img src="data:${refMime};base64,${b64(referenceFile)}" style="width:${cw}px;height:${ch}px;display:block">`],
        ["CURRENT", `<img src="data:image/png;base64,${b64(currentFile)}" style="width:${cw}px;height:${ch}px;display:block">`],
        ["OVERLAY 50%", `<div style="position:relative;width:${cw}px;height:${ch}px"><img src="data:${refMime};base64,${b64(referenceFile)}" style="position:absolute;inset:0;width:100%;height:100%"><img src="data:image/png;base64,${b64(currentFile)}" style="position:absolute;inset:0;width:100%;height:100%;opacity:.5"></div>`],
        ["DIFFERENCE", `<div style="position:relative;width:${cw}px;height:${ch}px;isolation:isolate"><img src="data:${refMime};base64,${b64(referenceFile)}" style="position:absolute;inset:0;width:100%;height:100%"><img src="data:image/png;base64,${b64(currentFile)}" style="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:difference"></div>`],
      ]
        .map(([t, img]) => `<div><div style="padding:0 0 8px">${t}</div>${img}</div>`)
        .join("")}
    </div></body></html>`;
  const ctx = await browser.newContext({ viewport: { width: 4 * cw + 60, height: ch + 50 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html);
  await page.waitForTimeout(300);
  const file = path.join(OUT, `${name}.compare.png`);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

const browser = await chromium.launch();
try {
  // 1) Mobile channel list — the screen we have a reference for.
  const mob = await shot(browser, "mobile-channels-fixture-430", "/?frame=ios&fixture=ref", { width: 430, height: 932 }, 1280 / 430);
  await shot(browser, "mobile-channels-430", "/?frame=ios", { width: 430, height: 932 }, 1280 / 430);
  await compareSheet(browser, "mobile-channels", mob, REF, 1280, 2772);

  // 2) Same screen at the spec's default phone size (no reference — usability check).
  await shot(browser, "mobile-channels-390", "/?frame=ios", { width: 390, height: 844 }, 2);

  // 3) Mobile chat — reference-parity fixture + real channel.
  const chat = await shot(browser, "mobile-chat-fixture-430", "/channels/lounge/general?frame=ios&fixture=ref", { width: 430, height: 932 }, 1280 / 430);
  await compareSheet(browser, "mobile-chat", chat, path.resolve("docs/reference/mobile-chat.jpg"), 1280, 2772);
  await shot(browser, "mobile-chat-430", "/channels/lounge/general?frame=ios", { width: 430, height: 932 }, 2);
  await shot(browser, "mobile-chat-390", "/channels/lounge/general?frame=ios", { width: 390, height: 844 }, 2);

  // 4) Desktop + tablet.
  await shot(browser, "desktop-general", "/channels/lounge/general", { width: 1440, height: 900 }, 1);
  await shot(browser, "desktop-hover", "/channels/lounge/general", { width: 1440, height: 900 }, 1, async (page) => {
    const rows = page.locator(".msg--group");
    const n = await rows.count();
    await rows.nth(Math.max(0, n - 4)).hover();
    await page.waitForTimeout(150);
  });
  await shot(browser, "tablet-general", "/channels/lounge/general", { width: 1024, height: 768 }, 1);
  console.log("✓ screenshots written to docs/screenshots/");
} finally {
  await browser.close();
}
