import type { Message, User } from "@/lib/types";
import { GUILDS } from "./guilds";
import { buildBacklog, SEED_MESSAGES } from "./messages";
import { ALL_USERS, NPC_PROFILES, NPC_USERS } from "./npcs";

export interface SeedSnapshot {
  users: User[];
  messages: Message[];
}

export function userIdForShort(short: string): string {
  return `u_${short}`;
}

export function buildSeed(nowMs: number): SeedSnapshot {
  return { users: ALL_USERS, messages: buildBacklog(nowMs, userIdForShort) };
}

/** Normalised fingerprint used by the uniqueness rule (also used by the sim later). */
export function fingerprint(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<@[^>]+>|@\w+/g, "@")
    .replace(/[^\p{L}\p{N}@ ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Common German function words — none may survive in English mode. */
const GERMAN_MARKERS = /\b(ich|und|nicht|ist|das|der|wer|bin|heute|mit|auch|aber|kein|keine|noch|schon|jetzt|wir|ihr|bitte|haben|gerade|sind|wieder|für|über|eine|einen|sehr|nach|weil|kommst|gibt|hab|mal|dass|oder|warum|wie|wo|euch|dich|mich)\b/i;

export function looksGerman(text: string): boolean {
  return GERMAN_MARKERS.test(text.replace(/@\w+|#[\w-]+|\b[A-Z][a-zäöü]+(?:straße|brötchen|park|strand|tunnel)\b/g, ""));
}

/** Validation used by `pnpm seed` — keeps the cast and backlog honest. */
export function validateSeed(): string[] {
  const errors: string[] = [];
  const ids = new Set(ALL_USERS.map((u) => u.id));
  if (NPC_USERS.length < 24 || NPC_USERS.length > 40) errors.push(`NPC count ${NPC_USERS.length} outside 24–40`);
  for (const p of NPC_PROFILES) {
    if (p.age < 20 || p.age > 34) errors.push(`${p.userId}: age ${p.age} outside 20–34`);
    if (p.traits.length < 2 || p.traits.length > 4) errors.push(`${p.userId}: needs 2–4 traits`);
    for (const r of p.relationships) if (!ids.has(r)) errors.push(`${p.userId}: unknown relationship ${r}`);
  }
  const channelIds = new Set(GUILDS.flatMap((g) => g.channels.map((c) => c.id)));
  const seen = new Map<string, string>();
  for (const [channelId, list] of Object.entries(SEED_MESSAGES)) {
    if (!channelIds.has(channelId)) errors.push(`messages for unknown channel ${channelId}`);
    const keys = new Set(list.map((s) => s.k));
    for (const s of list) {
      if (!ids.has(userIdForShort(s.a))) errors.push(`${channelId}/${s.k}: unknown author ${s.a}`);
      if (s.a === "elias") errors.push(`${channelId}/${s.k}: seed must never post as Elias`);
      if (s.re && !keys.has(s.re)) errors.push(`${channelId}/${s.k}: reply target ${s.re} missing`);
      const english = s.en ?? s.c;
      if (looksGerman(english)) errors.push(`${channelId}/${s.k}: German left in English mode → "${english.slice(0, 60)}"`);
      if (s.en && fingerprint(s.en) === fingerprint(s.c)) errors.push(`${channelId}/${s.k}: en equals original`);
      const fp = fingerprint(english);
      if (fp.length > 3) {
        const prev = seen.get(fp);
        if (prev) errors.push(`duplicate text ${channelId}/${s.k} == ${prev}`);
        seen.set(fp, `${channelId}/${s.k}`);
      }
    }
  }
  return errors;
}

/** Phrase-bank validation (stub brain): both languages, known slots, no German in English lines. */
export function validateBanks(banks: Record<string, Array<{ en: string; de: string }>>, slots: Record<string, { en: string[]; de: string[] }>): string[] {
  const errors: string[] = [];
  const known = new Set([...Object.keys(slots), "npc", "npc2", "name", "topic"]);
  for (const [k, v] of Object.entries(slots)) if (v.en.length !== v.de.length) errors.push(`slot ${k}: en/de lengths differ`);
  for (const [cat, lines] of Object.entries(banks)) {
    lines.forEach((l, i) => {
      if (!l.en.trim() || !l.de.trim()) errors.push(`${cat}[${i}]: missing language`);
      for (const side of [l.en, l.de]) for (const m of side.matchAll(/\{(\w+)\}/g)) if (!known.has(m[1]!)) errors.push(`${cat}[${i}]: unknown slot {${m[1]}}`);
      const slotsEn = [...l.en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      const slotsDe = [...l.de.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      if (slotsEn !== slotsDe) errors.push(`${cat}[${i}]: slots differ between en and de`);
      if (looksGerman(l.en.replace(/\{\w+\}/g, ""))) errors.push(`${cat}[${i}]: German in English line "${l.en}"`);
    });
  }
  return errors;
}
