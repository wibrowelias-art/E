/**
 * Link previews (Open Graph). Server-side fetch with SSRF guards: http(s) only,
 * standard ports, every hop's address must be public (checked after DNS), max 3
 * redirects, 5 s timeout, first 512 KB of HTML only. Results are cached in the
 * database for a day (failures for an hour).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Db } from "./sql";

export interface LinkPreview {
  url: string;
  site?: string;
  title?: string;
  description?: string;
  image?: string;
  color?: string;
}

const MAX_BYTES = 512 * 1024;
const OK_TTL = 24 * 3600_000;
const FAIL_TTL = 3600_000;

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return privateV4(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublic(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("port");
  if (u.username || u.password) throw new Error("credentials");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new Error("host");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("private address");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return undefined;
}

async function fetchHtml(start: string): Promise<{ url: string; html: string } | null> {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "TheLoungeLinkPreview/1.0 (+link previews)", Accept: "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    void reader.cancel().catch(() => {});
    return { url: url.toString(), html: Buffer.concat(chunks).toString("utf8") };
  }
  return null;
}

export async function unfurl(c: Db | null, raw: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const key = url.toString().slice(0, 500);
  if (c) {
    const r = await c.execute({ sql: "SELECT json, fetched_at FROM link_previews WHERE url = ?", args: [key] });
    const row = r.rows[0];
    if (row) {
      const cached = JSON.parse(String(row.json)) as LinkPreview | null;
      const age = Date.now() - Number(row.fetched_at);
      if (age < (cached ? OK_TTL : FAIL_TTL)) return cached;
    }
  }
  let preview: LinkPreview | null = null;
  try {
    const page = await fetchHtml(key);
    if (page) {
      const title = meta(page.html, ["og:title", "twitter:title"]) ?? decode(page.html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ?? "");
      const description = meta(page.html, ["og:description", "twitter:description", "description"]);
      let image = meta(page.html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
      if (image) {
        try {
          const abs = new URL(image, page.url);
          image = abs.protocol === "https:" ? abs.toString() : undefined;
        } catch {
          image = undefined;
        }
      }
      const site = meta(page.html, ["og:site_name", "application-name"]) ?? new URL(page.url).hostname.replace(/^www\./, "");
      const color = meta(page.html, ["theme-color"]);
      if (title || description) {
        preview = {
          url: key,
          site: site?.slice(0, 80),
          title: title?.slice(0, 200) || undefined,
          description: description?.slice(0, 300),
          image,
          color: color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : undefined,
        };
      }
    }
  } catch {
    preview = null;
  }
  if (c) {
    await c
      .execute({
        sql: "INSERT INTO link_previews (url, json, fetched_at) VALUES (?, ?, ?) ON CONFLICT (url) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at",
        args: [key, JSON.stringify(preview), Date.now()],
      })
      .catch(() => {});
  }
  return preview;
}
