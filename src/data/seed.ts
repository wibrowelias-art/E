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
      const fp = fingerprint(s.c);
      if (fp.length > 3) {
        const prev = seen.get(fp);
        if (prev) errors.push(`duplicate text ${channelId}/${s.k} == ${prev}`);
        seen.set(fp, `${channelId}/${s.k}`);
      }
    }
  }
  return errors;
}
