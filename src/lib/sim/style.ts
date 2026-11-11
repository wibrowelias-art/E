/**
 * Texting style (Phase 3: NPCs that feel human). Turns a clean phrase-bank
 * line into how this particular person would send it: mostly lowercase, their
 * slang, their emoji, the odd typo (sometimes followed by a "*fixed" message),
 * and longer thoughts sent as 2–3 quick messages instead of one paragraph.
 *
 * Every random decision is taken once and applied to both languages, so the
 * EN and DE versions stay the same message; only the word a typo lands on may
 * differ between them.
 */
import type { NpcPersonality } from "@/lib/types";

export type Rng = () => number;

export interface Part {
  en: string;
  de: string;
}

export interface Styled {
  /** 1–3 messages, sent in a row. */
  parts: Part[];
  /** The same thing as a single message (fallback when a split part would repeat a recent line). */
  whole: Part;
  /** A follow-up that fixes a typo ("*tonight"), sent right after `parts[after]`. */
  fix?: Part & { after: number };
}

/** Used for anyone without a personality file (never the case for the 32 NPCs). */
export const DEFAULT_PERSONALITY: NpcPersonality = {
  typingCpm: 280,
  activeHours: [17, 24],
  sleepHours: [1, 9],
  slang: { en: ["ngl …", "… tbh"], de: ["ehrlich …", "… safe"] },
  emojiRate: 0.2,
  emoji: ["😂", "🔥"],
  typoRate: 0.05,
  msgLength: 32,
  lowercase: 0.85,
  chattiness: 0.5,
  reactRate: 0.2,
  interests: [],
  friends: [],
  rivals: [],
};

export const EMOJI_RE = /\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*/gu;
const ENDS_WITH_EMOJI = /\p{Extended_Pictographic}️?$/u;
const BRAND = /^(IMAGEFORGE|SPOTLY|X100F)\W*$/;
const SLANG_RATE = 0.3;
const FIX_RATE = 0.45;

const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;

/** Lowercase everything except brand names and @mentions. */
export function lowerChat(t: string): string {
  return t.replace(/\S+/g, (w) => (w.startsWith("@") || BRAND.test(w) ? w : w.toLowerCase()));
}

function capitalise(t: string): string {
  const i = t.search(/\p{L}/u);
  if (i < 0) return t;
  return t.slice(0, i) + t.charAt(i).toUpperCase() + t.slice(i + 1);
}

/**
 * Natural break points for a burst: after . ? ! … (and , — : unless `strong`).
 * Never inside quotes or multi-line memes.
 */
function segments(t: string, strong = false): string[] {
  if (/["“„]/.test(t) || t.includes("\n")) return [t];
  const out: string[] = [];
  for (const s of t.split(strong ? /(?<=[.?!…])\s+/ : /(?<=[.?!…,—:])\s+/)) {
    const prev = out[out.length - 1];
    if (prev !== undefined && (s.length < 4 || prev.length < 4)) out[out.length - 1] = `${prev} ${s}`;
    else out.push(s);
  }
  return out;
}

const words = (t: string) => ` ${t.toLowerCase().replace(/[^\p{L}\p{N}\p{Extended_Pictographic}' ]+/gu, " ").replace(/\s+/g, " ").trim()} `;
/** True if `text` already contains the slang's words ("… no notes" in "perfect, no notes"). */
function hasWords(text: string, slang: string): boolean {
  const core = words(slang.replace("…", "")).trim();
  return !!core && words(text).includes(` ${core} `);
}

/** Fold a segment list down to `n` pieces (the tail stays together). */
function fold(segs: string[], n: number): string[] {
  if (segs.length <= n) return segs;
  return [...segs.slice(0, n - 1), segs.slice(n - 1).join(" ")];
}

/** Chat messages don't end in commas or dashes; lowercase texters drop the full stop too. */
function tidy(t: string, dropPeriod: boolean): string {
  let out = t.trim().replace(/\s*[,—–-]+$/, "").trim();
  if (dropPeriod) out = out.replace(/(?<![.])\.$/, "");
  return out;
}

const ROWS = ["qwertzuiop", "asdfghjkl", "yxcvbnm"];
function neighbour(ch: string, r: number): string {
  for (const row of ROWS) {
    const i = row.indexOf(ch);
    if (i < 0) continue;
    const opts = [row[i - 1], row[i + 1]].filter((c): c is string => !!c);
    return opts.length ? opts[Math.floor(r * opts.length)]! : ch;
  }
  return ch;
}

/** One realistic slip of the thumb: swapped, dropped, doubled or neighbouring letter. */
export function typoWord(w: string, rng: Rng): string {
  const p = 1 + Math.floor(rng() * (w.length - 2));
  const op = rng();
  if (op < 0.35) return w.slice(0, p) + w[p + 1] + w[p] + w.slice(p + 2);
  if (op < 0.6) return w.slice(0, p) + w.slice(p + 1);
  if (op < 0.8) return w.slice(0, p) + w[p] + w.slice(p);
  return w.slice(0, p) + neighbour(w[p]!, rng()) + w.slice(p + 1);
}

/** Put a typo into one word of `t`; returns the new text and the word as it should have been. */
function typoIn(t: string, rng: Rng): { text: string; word: string } | null {
  const words = t.split(" ");
  const idx = words.map((w, i) => (/^[a-zäöüß]{4,}$/.test(w) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const i = pick(idx, rng);
  const word = words[i]!;
  let bad = typoWord(word, rng);
  if (bad === word) bad = word.slice(0, -1);
  words[i] = bad;
  return { text: words.join(" "), word };
}

export interface StyleInput {
  en: string;
  de: string;
  persona?: NpcPersonality;
  tone: { hype: boolean; chill: boolean };
  /** Callbacks: one message, no slang or typos (the quote stays verbatim). */
  noSplit?: boolean;
  rng: Rng;
}

/** Apply one person's texting habits to a line (both languages at once). */
export function humanize(input: StyleInput): Styled | null {
  const { rng, tone } = input;
  const p = input.persona ?? DEFAULT_PERSONALITY;

  /* ── decisions, shared by both languages ── */
  const lower = rng() < p.lowercase;
  const period = !lower && rng() < 0.5;
  const calm = tone.chill && rng() < 0.6;
  const noEmoji = p.emojiRate === 0 || calm;
  const emoji = !noEmoji && p.emoji.length && rng() < Math.min(0.9, p.emojiRate + (tone.hype ? 0.1 : 0)) ? (rng() < 0.6 ? p.emoji[0]! : pick(p.emoji, rng)) : "";
  const emojiAlone = !!emoji && rng() < 0.15;
  let slangIdx = !input.noSplit && p.slang.en.length && rng() < SLANG_RATE ? Math.floor(rng() * p.slang.en.length) : -1;
  // Skip it (in both languages) when the line already says it ("no notes — no notes").
  if (slangIdx >= 0 && (hasWords(input.en, p.slang.en[slangIdx]!) || hasWords(input.de, p.slang.de[slangIdx]!))) slangIdx = -1;
  const doTypo = !input.noSplit && rng() < p.typoRate + (tone.hype ? 0.03 : 0);
  const doFix = rng() < FIX_RATE;
  const fixStyle = Math.floor(rng() * 6);
  const mention = !input.noSplit && /\belias\b/i.test(input.en) && /\belias\b/i.test(input.de) && rng() < 0.12;
  const caps = input.en.length < 60 && rng() < (p.caps ?? 0) + (tone.hype && p.caps ? 0.05 : 0);

  // Split / trim: long lines go out as a burst; very short texters often just send the first bit.
  // EN and DE must break at the same places: commas first, else sentence ends only, else not at all.
  let segEn = segments(input.en);
  let segDe = segments(input.de);
  if (segEn.length !== segDe.length) {
    segEn = segments(input.en, true);
    segDe = segments(input.de, true);
  }
  if (segEn.length !== segDe.length) {
    segEn = [input.en];
    segDe = [input.de];
  }
  const n = Math.min(segEn.length, 3);
  let mode: "one" | "burst" | "trim" = "one";
  if (!input.noSplit && n >= 2) {
    const limit = Math.max(24, p.msgLength * 1.3);
    if (input.en.length > limit) mode = rng() < (p.msgLength < 22 ? 0.45 : 0.12) ? "trim" : rng() < 0.8 ? "burst" : "one";
    else if (input.en.length > 22 && rng() < 0.18) mode = "burst";
  }
  // Only drop the rest after a finished sentence ("rain again." ✓, "if elias says it," ✗).
  if (mode === "trim" && (segEn[0]!.split(" ").length < 2 || segDe[0]!.split(" ").length < 2 || !/[.?!…]$/.test(segEn[0]!) || !/[.?!…]$/.test(segDe[0]!))) mode = "burst";

  const build = (segs: string[], lang: "en" | "de", as: typeof mode): string[] => {
    let parts = as === "burst" ? fold(segs, n) : as === "trim" ? [segs[0]!] : [segs.join(" ")];
    parts = parts.map((t) => tidy(lower ? lowerChat(t) : t, lower || as !== "one"));
    if (noEmoji) parts = parts.map((t) => t.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim());
    if (calm) parts = parts.map((t) => t.replace(/!+/g, ""));
    parts = parts.filter(Boolean);
    if (!parts.length) return parts;
    if (mention) {
      const i = parts.findIndex((t) => /\belias\b/i.test(t));
      if (i >= 0) parts[i] = parts[i]!.replace(/\belias\b/i, "@Elias");
    }
    if (slangIdx >= 0) {
      const s = p.slang[lang][slangIdx]!;
      if (!s.includes("…")) {
        if (parts.length < 3) parts.push(s);
      } else if (s.startsWith("…")) {
        const last = parts.length - 1;
        parts[last] = `${parts[last]}${s.slice(1)}`;
      } else {
        parts[0] = `${s.slice(0, s.indexOf("…")).trim()} ${parts[0]}`;
      }
    }
    if (emoji) {
      if (emojiAlone && parts.length < 3) {
        if (parts[parts.length - 1] !== emoji) parts.push(emoji);
      }
      else {
        const last = parts.length - 1;
        if (!ENDS_WITH_EMOJI.test(parts[last]!)) parts[last] = `${parts[last]} ${emoji}`;
      }
    }
    if (!lower) parts = parts.map((t, i) => (i === parts.length - 1 && period && /\p{L}$/u.test(t) ? capitalise(t) + "." : capitalise(t)));
    if (caps) parts = parts.map((t) => t.toUpperCase().replace(/@ELIAS/g, "@Elias"));
    return parts;
  };

  let en = build(segEn, "en", mode);
  let de = build(segDe, "de", mode);
  if (!en.length || !de.length) return null;
  // Keep the two languages the same number of messages.
  const m = Math.min(en.length, de.length);
  en = fold(en, m);
  de = fold(de, m);
  // The same line as one message (keeps its commas), for when a burst can't go out.
  const one = mode === "trim" ? en : build(segEn, "en", "one");
  const oneDe = mode === "trim" ? de : build(segDe, "de", "one");
  const whole: Part = { en: one.join(" "), de: oneDe.join(" ") };

  let fix: Styled["fix"];
  if (doTypo) {
    // Land the typo in the longest message; it may hit different words in EN and DE.
    const at = en.reduce((best, t, i) => (t.length > en[best]!.length ? i : best), 0);
    const te = typoIn(en[at]!, rng);
    const td = typoIn(de[at]!, rng);
    if (te) en[at] = te.text;
    if (td) de[at] = td.text;
    if (te && td && doFix && m < 3 && !caps) {
      const fmt = (w: string) => [`*${w}`, `*${w}`, `${w}*`, `*${w} lol`, `*${w} sorry`, `*${w} omg`][fixStyle]!;
      fix = { en: fmt(te.word), de: fmt(td.word), after: at };
    }
  }
  return { parts: en.map((t, i) => ({ en: t, de: de[i]! })), whole, fix };
}

/**
 * How long this person types `text` on a phone: their speed in characters
 * per minute, a little jitter, plus a moment to think before the first key.
 */
export function typingMs(text: string, persona: NpcPersonality | undefined, rng: Rng): number {
  const cpm = (persona ?? DEFAULT_PERSONALITY).typingCpm;
  const chars = [...text].length;
  return Math.round((chars / cpm) * 60_000 * (0.85 + rng() * 0.35) + 350 + rng() * 900);
}

/* ───────── active hours (Hamburg time) ───────── */

export function inHours(hour: number, [from, to]: readonly [number, number]): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Stable pseudo-random number in [0, 1) for a key — same input, same answer, across server instances. */
export function stableRand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
