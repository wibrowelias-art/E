/**
 * Stub brain: turns Backstage settings + persona into one chat line, in both
 * languages at once (so the language switch can re-render it later).
 * Phase 4 swaps `composeLine` for a ChatProvider call when an AI key exists.
 */
import { fingerprint } from "@/data/seed";
import type { Lang } from "@/lib/i18n";
import type { NpcProfile, SimSettings, User } from "@/lib/types";
import { BANKS, SLOTS, type Category, type Line } from "./banks";

export type Rng = () => number;

const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ───────────── prompt parsing ───────────── */

const TONE_WORDS = {
  hype: ["hype", "hyped", "excited", "loud", "energy", "energetic", "aufgedreht", "laut", "crazy", "wild"],
  chill: ["chill", "calm", "relaxed", "slow", "sleepy", "lazy", "entspannt", "ruhig", "gemütlich"],
  salty: ["salty", "sarcastic", "roast", "mean", "toxic", "angry", "petty", "sarkastisch", "frech", "gemein"],
  kind: ["kind", "friendly", "wholesome", "nice", "sweet", "supportive", "lieb", "nett", "freundlich"],
};
const TONE_MARKERS = [
  ...Object.values(TONE_WORDS).flat(),
  "teasing", "specific", "playful", "funny", "polite", "honest", "short", "casual", "not mean", "spammy",
];
const LEAD_INS = /^(?:please\s+)?(?:talk|chat|gossip|argue|rant)\s+about\s+|^(?:discuss|focus on|mention|redet über|sprecht über|redet von|über)\s+|^(?:they|everyone|people|npcs)\s+(?:should\s+)?(?:talk\s+about\s+)?/i;

export interface ParsedPrompt {
  topics: string[];
  tone: { hype: boolean; chill: boolean; salty: boolean; kind: boolean };
}

export function parsePrompt(prompt: string): ParsedPrompt {
  const lower = prompt.toLowerCase();
  const has = (words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
  const tone = { hype: has(TONE_WORDS.hype), chill: has(TONE_WORDS.chill), salty: has(TONE_WORDS.salty), kind: has(TONE_WORDS.kind) };
  const topics: string[] = [];
  for (const raw of prompt.split(/[\n.;,!?&]+|\s+(?:and|und|or|oder)\s+/i)) {
    let chunk = raw.trim().replace(LEAD_INS, "").trim();
    if (!chunk) continue;
    const c = chunk.toLowerCase();
    if (/^(?:be|act|sound|keep|stay|make|seid|sei|bleibt)\b/i.test(chunk)) continue;
    if (TONE_MARKERS.some((w) => c === w || c.includes(` ${w}`) || c.startsWith(`${w} `) || c.startsWith(w))) continue;
    const words = chunk.split(/\s+/);
    if (chunk.length < 2 || chunk.length > 48 || words.length > 7) continue;
    // chat is lowercase; keep ALLCAPS names like IMAGEFORGE
    topics.push(chunk.split(/\s+/).map((w) => (/^[A-Z0-9]{2,}/.test(w) ? w : w.toLowerCase())).join(" "));
  }
  return { topics: [...new Set(topics)].slice(0, 12), tone };
}

/* ───────────── category choice ───────────── */

export interface Effective {
  glaze: number; // 0..1
  drama: number; // 0..1
}

export function effective(s: SimSettings, p: ParsedPrompt): Effective {
  const g = s.glaze / 100;
  const d = s.drama / 100;
  // Tone words nudge the sliders, but never move an extreme (0% / 100% stay absolute).
  const room = (v: number) => Math.min(1, v * 10, (1 - v) * 10);
  let glaze = g;
  let drama = d;
  if (p.tone.salty) (glaze -= 0.12 * room(g)), (drama += 0.15 * room(d));
  if (p.tone.kind) (drama -= 0.15 * room(d)), (glaze += 0.05 * room(g));
  return { glaze: clamp01(glaze), drama: clamp01(drama) };
}

function weighted<T extends string>(w: Record<T, number>, rng: Rng): T {
  const entries = Object.entries(w) as Array<[T, number]>;
  const total = entries.reduce((n, [, v]) => n + Math.max(0, v), 0);
  let u = rng() * total;
  for (const [k, v] of entries) {
    u -= Math.max(0, v);
    if (u <= 0) return k;
  }
  return entries[entries.length - 1]![0];
}

export function eliasCategory(glaze: number, rng: Rng): Category {
  const neutralShare = 0.22 * (1 - Math.abs(glaze - 0.5) * 1.6);
  if (rng() < neutralShare) return "mild";
  if (rng() < glaze) return rng() < clamp01((glaze - 0.55) / 0.45) * 0.8 ? "worship" : "praise";
  return rng() < clamp01((0.45 - glaze) / 0.45) * 0.8 ? "roast" : "critical";
}

export function freshCategory(s: SimSettings, e: Effective, hasTopics: boolean, rng: Rng): Category {
  const bucket = weighted(
    {
      elias: 0.42,
      drama: 0.03 + e.drama * 0.37,
      wholesome: (1 - e.drama) * 0.1,
      prompt: hasTopics ? 0.3 : 0,
      meta: s.breakCharacter ? 0.08 : 0,
      topic: 0.36,
    },
    rng,
  );
  if (bucket === "elias") return eliasCategory(e.glaze, rng);
  return bucket as Category;
}

export function replyCategory(e: Effective, parentTag: string | undefined, rng: Rng): Category {
  const parentPositive = parentTag === "worship" || parentTag === "praise";
  const parentNegative = parentTag === "roast" || parentTag === "critical";
  const mismatch = (parentPositive && e.glaze < 0.4) || (parentNegative && e.glaze > 0.6) ? 1 : 0;
  return weighted(
    {
      agree: 0.4 - mismatch * 0.25,
      laugh: parentTag === "drama" || parentTag === "roast" ? 0.35 : 0.22,
      question: parentTag === "drama" ? 0.25 : 0.12,
      disagree: 0.08 + e.drama * 0.45 + mismatch * 0.35,
    },
    rng,
  );
}

export function ownerReplyCategory(e: Effective, rng: Rng): Category {
  return weighted({ ownerPos: e.glaze, ownerNeg: (1 - e.glaze) * 0.85, ownerNeutral: 0.2 }, rng);
}

/* ───────────── persona styles ───────────── */

interface Style {
  emoji?: [string[], number];
  caps?: number;
  noEmoji?: boolean;
  proper?: boolean;
  typo?: number;
}
const STYLE: Record<string, Style> = {
  u_mara: { emoji: [["😭😭", "🔥🔥", "🌅", "✨✨"], 0.35] },
  u_ben: { emoji: [["💪", "🔥", "💪🔥"], 0.5] },
  u_kemal: { emoji: [["💀"], 0.3] },
  u_pia: { caps: 0.12, emoji: [["😭", "😩"], 0.35] },
  u_leni: { caps: 0.18 },
  u_jule: { emoji: [["😩", "✨"], 0.3] },
  u_hanna: { emoji: [["✨"], 0.2] },
  u_noor: { noEmoji: true },
  u_theo: { proper: true, noEmoji: true },
  u_zara: { proper: true },
  u_sofia: { proper: true },
  u_finn: { typo: 0.18 },
  u_vincent: { emoji: [["💸"], 0.15] },
};

const EMOJI_RE = /\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*/gu;
const ENDS_WITH_EMOJI = /\p{Extended_Pictographic}\uFE0F?$/u;

function typoOnce(text: string, at: number): string {
  const words = text.split(" ");
  const idx = words.findIndex((w, i) => i >= at % Math.max(1, words.length) && /^[a-zäöü]{5,}$/.test(w));
  if (idx < 0) return text;
  const w = words[idx]!;
  const p = 1 + (at % (w.length - 2));
  words[idx] = w.slice(0, p) + w[p + 1] + w[p] + w.slice(p + 2);
  return words.join(" ");
}

/* ───────────── composition ───────────── */

export interface ComposeInput {
  category: Category;
  settings: SimSettings;
  parsed: ParsedPrompt;
  author: User;
  profile?: NpcProfile;
  lang: Lang;
  channelId: string;
  replyToName?: string;
  otherNames: string[];
  recent: Set<string>;
  /** Template keys used recently — avoids near-duplicates from the same template. */
  avoid: Set<string>;
  rng: Rng;
}

/** Uniqueness key: normalised text, or the raw string for emoji-only / very short lines. */
export function uniqKey(text: string): string {
  const fp = fingerprint(text);
  return fp.length > 3 ? fp : `raw:${text.trim()}`;
}

export interface Composed {
  en: string;
  de: string;
  /** Version shown in "Deutsch" mode (German or English depending on the persona). */
  mix: string;
  category: Category;
  template: string;
}

function linesFor(category: Category, channelId: string, rng: Rng): Array<{ line: Line; key: string }> {
  const bank = BANKS[category].map((line, i) => ({ line, key: `${category}:${i}` }));
  const local = bank.filter((l) => !l.line.ch || l.line.ch.includes(channelId));
  // Mostly stay on-channel; sometimes drift (wrong-channel energy is part of the vibe).
  return local.length && rng() < 0.85 ? local : bank;
}

export function composeLine(input: ComposeInput): Composed | null {
  const { category, rng } = input;
  const style = STYLE[input.author.id] ?? {};
  for (let attempt = 0; attempt < 12; attempt++) {
    const topic = input.parsed.topics.length ? pick(input.parsed.topics, rng) : "tonight";
    // "does elias know about elias' drops" → skip Elias-templates when the topic is already about him.
    const fits = (o: { line: Line; key: string }) =>
      !input.avoid.has(o.key) && !(o.line.en.includes("{topic}") && /elias/i.test(topic) && /elias/i.test(o.line.en.replace("{topic}", "")));
    const options = linesFor(category, input.channelId, rng);
    let fresh = options.filter(fits);
    if (!fresh.length) fresh = linesFor(category, "*", () => 1).filter(fits);
    // Every template in this mood was used recently → let the caller pick another category
    // (short reply fillers may repeat once they're out of the window).
    if (!fresh.length) return null;
    const { line, key: template } = pick(fresh, rng);
    const slotIdx: Record<string, number> = {};
    const others = input.otherNames.filter((n) => n !== input.author.displayName);
    const npc = others.length ? pick(others, rng) : "someone";
    const npc2 = others.filter((n) => n !== npc).length ? pick(others.filter((n) => n !== npc), rng) : "someone";
    const fill = (tpl: string, lang: "en" | "de") =>
      tpl.replace(/\{(\w+)\}/g, (_, key: string) => {
        if (key === "npc") return npc;
        if (key === "npc2") return npc2;
        if (key === "name") return input.replyToName ?? npc;
        if (key === "topic") return topic;
        const slot = SLOTS[key];
        if (!slot) return key;
        slotIdx[key] ??= Math.floor(rng() * slot.en.length);
        return slot[lang][slotIdx[key]!]!;
      });
    let en = fill(line.en, "en");
    let de = fill(line.de, "de");

    // Shared random decisions so both language versions stay in sync.
    const mention = /\belias\b/i.test(en) && /\belias\b/i.test(de) && rng() < 0.12;
    const caps = (style.caps ?? 0) + (input.parsed.tone.hype ? 0.06 : 0);
    const doCaps = en.length < 70 && rng() < caps;
    const emoji = style.emoji && rng() < style.emoji[1] ? pick(style.emoji[0], rng) : input.parsed.tone.hype && rng() < 0.25 ? pick(["🔥", "🙌", "!!"], rng) : "";
    const typoAt = style.typo && rng() < style.typo ? Math.floor(rng() * 1000) : -1;
    const calm = input.parsed.tone.chill && rng() < 0.6;

    const finish = (t: string) => {
      let out = t;
      if (mention) out = out.replace(/\belias\b/i, "@Elias");
      if (style.noEmoji || calm) out = out.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
      if (calm) out = out.replace(/!+/g, "");
      if (emoji && !style.noEmoji && !calm) out = `${out} ${emoji}`;
      if (typoAt >= 0) out = typoOnce(out, typoAt);
      if (doCaps) out = out.toUpperCase().replace(/@ELIAS/g, "@Elias");
      if (style.proper && out) {
        out = out.charAt(0).toUpperCase() + out.slice(1);
        if (!/[.!?…)]$/.test(out) && !ENDS_WITH_EMOJI.test(out)) out += ".";
      }
      return out.trim();
    };
    en = finish(en);
    de = finish(de);
    if (!en || !de) continue;
    const useGerman = rng() < (input.profile?.germanRatio ?? 0.5);
    const mix = useGerman ? de : en;
    const shown = input.lang === "en" ? en : mix;
    if (input.recent.has(uniqKey(shown)) || input.recent.has(uniqKey(en))) continue;
    return { en, de, mix, category, template };
  }
  return null;
}
