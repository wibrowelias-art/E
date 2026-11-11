/**
 * Stub brain: turns Backstage settings + persona into one chat line, in both
 * languages at once (so the language switch can re-render it later).
 * Each line is then run through the author's texting style (./style.ts).
 */
import { fingerprint } from "@/data/seed";
import { safetyCheck } from "@/lib/safety";
import type { Lang } from "@/lib/i18n";
import type { NpcProfile, SimSettings, User } from "@/lib/types";
import { BANKS, SLOTS, VLOG_PROMISED_AT, type Category, type GagId, type Line } from "./banks";
import { humanize } from "./style";
import { DEFAULT_SIM } from "./settings";

const DEFAULT_PROMPT = DEFAULT_SIM.prompt;

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

/** A prompt the owner wrote themselves steers harder than the default vibe. */
export function promptWeight(s: SimSettings, hasTopics: boolean): number {
  if (!hasTopics) return 0;
  return s.prompt.trim() === DEFAULT_PROMPT.trim() ? 0.3 : 0.65;
}


export function freshCategory(
  s: SimSettings,
  e: Effective,
  hasTopics: boolean,
  rng: Rng,
  extra: { lore?: boolean; callback?: boolean } = {},
): Category {
  const bucket = weighted(
    {
      elias: 0.46,
      drama: 0.03 + e.drama * 0.37,
      wholesome: (1 - e.drama) * 0.1,
      prompt: promptWeight(s, hasTopics),
      meta: s.breakCharacter ? 0.08 : 0,
      topic: 0.36,
      // Server lore (running gags) and callbacks to earlier lines.
      lore: extra.lore ? 0.1 : 0,
      callback: extra.callback ? 0.07 : 0,
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
      laugh: parentTag === "drama" || parentTag === "roast" || parentTag?.startsWith("lore") ? 0.35 : 0.22,
      question: parentTag === "drama" ? 0.25 : 0.12,
      disagree: 0.08 + e.drama * 0.45 + mismatch * 0.35,
    },
    rng,
  );
}

export function ownerReplyCategory(e: Effective, rng: Rng): Category {
  return weighted({ ownerPos: e.glaze, ownerNeg: (1 - e.glaze) * 0.85, ownerNeutral: 0.2 }, rng);
}

/** What someone says when the owner (or a guest) posts: answers to questions, quick reactions, opinions. */
export function humanReplyCategory(e: Effective, question: boolean, rng: Rng): Category {
  if (question) {
    const r = rng();
    return r < 0.45 ? "answer" : r < 0.65 ? "short" : ownerReplyCategory(e, rng);
  }
  return rng() < 0.6 ? ownerReplyCategory(e, rng) : "short";
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
  /** Template keys used recently, newest first — avoids near-duplicates from the same template. */
  avoid: readonly string[];
  /** Recent lines (English), newest last — near-duplicate guard. */
  recentTexts?: readonly string[];
  /** Running gag to reference (category "lore"). */
  gag?: GagId;
  /** Fragment of an earlier line (category "callback"), per language. */
  quote?: { en: string; de: string };
  /** Floor time of the line (the vlog counter grows with it). */
  now?: number;
  rng: Rng;
}

const wordSet = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 1));

/** True if `text` shares ≥75% of its words with any recent line (same template, one slot swapped). */
export function nearDuplicate(text: string, recent: readonly string[]): boolean {
  const a = wordSet(text);
  if (a.size < 3) return false;
  for (const r of recent) {
    const b = wordSet(r);
    if (b.size < 3) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    if (inter / (a.size + b.size - inter) >= 0.75) return true;
  }
  return false;
}

/** Uniqueness key: normalised text, or the raw string for emoji-only / very short lines. */
export function uniqKey(text: string): string {
  const fp = fingerprint(text);
  return fp.length > 3 ? fp : `raw:${text.trim()}`;
}

export interface ComposedPart {
  en: string;
  de: string;
  /** What's shown in "Deutsch" mode (German or English, following the persona). */
  mix: string;
}

export interface Composed extends ComposedPart {
  category: Category;
  template: string;
  /** The line as this person sends it: 1–3 messages in a row … */
  parts: ComposedPart[];
  /** … and maybe a typo fix right after `parts[fix.after]`. */
  fix?: ComposedPart & { after: number };
  /** Running gag referenced, if any. */
  gag?: GagId;
}

function linesFor(category: Category, channelId: string, rng: Rng): Array<{ line: Line; key: string }> {
  const bank = BANKS[category].map((line, i) => ({ line, key: `${category}:${i}` }));
  const local = bank.filter((l) => !l.line.ch || l.line.ch.includes(channelId));
  // Mostly stay on-channel; sometimes drift (wrong-channel energy is part of the vibe).
  return local.length && rng() < 0.85 ? local : bank;
}

export function vlogDay(now: number): number {
  return Math.max(1, Math.floor((now - VLOG_PROMISED_AT) / 86_400_000));
}

export function composeLine(input: ComposeInput): Composed | null {
  const { category, rng } = input;
  // Per-mood window: block every recently used template of a mood, but always leave the
  // least-recently-used ~20% (min 2) free — so long-running floors never run dry.
  const blocked = new Set<string>();
  const perCategory = new Map<string, number>();
  for (const key of input.avoid) {
    if (blocked.has(key)) continue;
    const cat = key.slice(0, key.lastIndexOf(":"));
    const used = perCategory.get(cat) ?? 0;
    const size = BANKS[cat as Category]?.length ?? 0;
    if (used < size - Math.max(2, Math.ceil(size * 0.2))) blocked.add(key);
    perCategory.set(cat, used + 1);
  }
  const author = input.author.id;
  const usable = (l: Line) =>
    (!l.only || l.only.includes(author)) &&
    !l.skip?.includes(author) &&
    (category !== "lore" || !input.gag || l.gag === input.gag) &&
    (category !== "callback" || !!input.quote);
  const tried = new Set<string>(); // templates rejected this call — never re-drawn
  for (let attempt = 0; attempt < 16; attempt++) {
    const topic = input.parsed.topics.length ? pick(input.parsed.topics, rng) : "tonight";
    // "does elias know about elias' drops" → skip Elias-templates when the topic is already about him.
    const fits = (o: { line: Line; key: string }) =>
      usable(o.line) &&
      !blocked.has(o.key) &&
      !tried.has(o.key) &&
      !(o.line.en.includes("{topic}") && /elias/i.test(topic) && /elias/i.test(o.line.en.replace("{topic}", "")));
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
        if (key === "quote") return input.quote?.[lang] ?? "";
        if (key === "vlogday") return String(vlogDay(input.now ?? Date.now()));
        const slot = SLOTS[key];
        if (!slot) return key;
        slotIdx[key] ??= Math.floor(rng() * slot.en.length);
        return slot[lang][slotIdx[key]!]!;
      });
    const baseEn = fill(line.en, "en");
    const baseDe = fill(line.de, "de");
    if (!safetyCheck(baseEn).ok || !safetyCheck(baseDe).ok) {
      tried.add(template); // hard filter, same as the server
      continue;
    }
    const styled = humanize({
      en: baseEn,
      de: baseDe,
      persona: input.profile?.personality,
      tone: input.parsed.tone,
      noSplit: category === "callback",
      rng,
    });
    if (!styled) {
      tried.add(template);
      continue;
    }
    const all = [styled.whole, ...styled.parts, ...(styled.fix ? [styled.fix] : [])];
    if (all.some((p) => !safetyCheck(p.en).ok || !safetyCheck(p.de).ok)) {
      tried.add(template);
      continue;
    }
    const useGerman = rng() < (input.profile?.germanRatio ?? 0.5);
    const mixOf = (p: { en: string; de: string }): ComposedPart => ({ en: p.en, de: p.de, mix: useGerman ? p.de : p.en });
    const whole = mixOf(styled.whole);
    const shown = input.lang === "en" ? whole.en : whole.mix;
    const seen = (t: string) => input.recent.has(uniqKey(t));
    if (
      seen(shown) ||
      seen(whole.en) ||
      seen(baseEn) ||
      (input.recentTexts && (nearDuplicate(whole.en, input.recentTexts) || nearDuplicate(baseEn, input.recentTexts)))
    ) {
      // Slot-free templates can't produce a different text — skip them; others may retry with new slots.
      if (!/\{\w+\}/.test(line.en)) tried.add(template);
      continue;
    }
    // A burst whose pieces would repeat a recent line goes out as one message instead.
    let parts = styled.parts.map(mixOf);
    let fix = styled.fix ? { ...mixOf(styled.fix), after: styled.fix.after } : undefined;
    if (parts.length > 1 && parts.some((p) => seen(p.en) || seen(p.mix))) {
      parts = [whole];
      fix = undefined;
    }
    if (fix && (seen(fix.en) || seen(fix.mix))) fix = undefined;
    return { ...whole, category, template, parts, fix, gag: line.gag };
  }
  return null;
}
