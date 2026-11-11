/**
 * Floor planner (Phase 3): pure, clock-free simulation logic shared by the
 * server tick and the in-browser local floor. Given a world snapshot and a
 * time window it returns the events that happen in that window — messages
 * (with typing time), reactions, voice / presence changes. No timers, no I/O:
 * the caller persists or schedules the events, and tests can run hours of
 * floor in milliseconds.
 *
 * "NPCs that feel human": every NPC has a personality file (src/data/npcs.ts)
 * — typing speed, active hours, slang, emoji, typos, message length, friends
 * and rivals. Replies to a human take 2–40 s with a typing indicator first,
 * sometimes nobody answers (or someone just reacts), long thoughts go out as
 * 2–3 quick messages, running gags come back, and presence follows each
 * person's day in Hamburg time.
 */
import { NPC_PROFILES, NPC_USERS } from "@/data/npcs";
import type { Message, NpcPersonality, Presence, SimSettings, User } from "@/lib/types";
import { GAGS, type Category, type GagId } from "./banks";
import {
  composeLine,
  effective,
  eliasCategory,
  freshCategory,
  humanReplyCategory,
  ownerReplyCategory,
  parsePrompt,
  replyCategory,
  uniqKey,
  type Composed,
  type ComposedPart,
  type ParsedPrompt,
  type Rng,
} from "./brain";
import { DEFAULT_PERSONALITY, EMOJI_RE, inHours, lowerChat, stableRand, typingMs } from "./style";

export const SIM_CHANNEL_WEIGHTS: Record<string, number> = {
  c_general: 30,
  c_hhnight: 16,
  c_glaze: 14,
  c_photo: 10,
  c_build: 10,
  c_random: 10,
  c_memes: 8,
};
/** Answers to a human arrive this long after the post (typing indicator first). */
export const HUMAN_REPLY_MIN_MS = 2_000;
export const HUMAN_REPLY_MAX_MS = 40_000;

const VOICE = ["c_vc_main", "c_vc_after"];
const ELIAS_TAGS = new Set(["worship", "praise", "mild", "critical", "roast", "ownerPos", "ownerNeg"]);
const PROFILE = new Map(NPC_PROFILES.map((p) => [p.userId, p]));
const SEED_PRESENCE = new Map(NPC_USERS.map((u) => [u.id, u.presence]));
const REACTIONS: Record<string, string[]> = {
  worship: ["🔥", "✨", "🖤", "🙌", "📸"],
  praise: ["🔥", "✨", "🖤", "💯"],
  roast: ["💀", "😬", "👀", "😂"],
  critical: ["👀", "😬", "💯"],
  drama: ["👀", "🍿", "😳"],
  bicker: ["👀", "🍿", "💀"],
  laugh: ["😭", "💀"],
  lore: ["😭", "💀", "😂", "🫡"],
  wholesome: ["🖤", "🥹", "🫶"],
  greet: ["👋", "🖤"],
  human: ["🔥", "😂", "👀", "💯", "🫡", "🖤"],
  default: ["😂", "🔥", "👀", "💯", "🫡", "😭"],
};

export interface PlannerState {
  nextStepAt: number;
  flurryLeft: number;
  flurryChannel: string;
  threadId: string | null;
  /** Recently used template keys (near-duplicate guard across ticks). */
  templates: string[];
  /** Cold open: the next N posts after the first reply into the thread (a chain forms right away). */
  warm?: number;
  /** Running gag → when it was last brought up (they come back, but not every minute). */
  gags?: Partial<Record<GagId, number>>;
  /** Last time presence was matched to everyone's active hours. */
  presenceAt?: number;
  /** Cold open: the first few lines were already being typed when you arrived (short typing). */
  fast?: number;
}

export function initialPlannerState(now: number): PlannerState {
  return { nextStepAt: now + 800, flurryLeft: 5, flurryChannel: "c_general", threadId: null, templates: [], warm: 1, fast: 5 };
}

export interface World {
  settings: SimSettings;
  users: Map<string, User>;
  /** Per channel, oldest → newest (includes already-scheduled future messages). */
  recent: Map<string, Message[]>;
  /** Recent lines anywhere, in English, oldest → newest (global uniqueness window). */
  texts: string[];
  /** Channel where a human spoke recently — the room gets busier there. */
  focusChannel?: string;
  rng: Rng;
}

export type FloorEvent =
  /** `group` ties together the 2–3 messages one NPC sends in a row (+ a typo fix); `part` is the position. */
  | { kind: "message"; message: Message; typingMs: number; group?: string; part?: number; whole?: ComposedPart }
  /** `by` = the NPC reacting; `instead` = they reacted instead of writing a reply. */
  | { kind: "reaction"; messageId: string; emoji: string; at: number; by?: string; instead?: boolean }
  | { kind: "user"; userId: string; patch: Partial<User>; at: number };

type Draft = { c: Composed; author: User; replyToId?: string };
type DraftResult = Draft | { react: { messageId: string; emoji: string; author: User } } | null;

const rand = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function weightedPick<T>(items: Array<[T, number]>, rng: Rng): T | undefined {
  const total = items.reduce((n, [, w]) => n + Math.max(0, w), 0);
  if (total <= 0) return undefined;
  let u = rng() * total;
  for (const [item, w] of items) {
    u -= Math.max(0, w);
    if (u <= 0) return item;
  }
  return items[items.length - 1]?.[0];
}

export function personaOf(userId: string): NpcPersonality {
  return PROFILE.get(userId)?.personality ?? DEFAULT_PERSONALITY;
}

/** Whole-floor rhythm by local hour: dead early morning, packed late evening. */
export function timeOfDayFactor(ts: number, tzOffsetMin = hamburgOffset(ts)): number {
  const hour = new Date(ts + tzOffsetMin * 60_000).getUTCHours();
  if (hour >= 4 && hour < 8) return 0.3;
  if (hour >= 8 && hour < 12) return 0.7;
  if (hour >= 12 && hour < 18) return 0.9;
  if (hour >= 18 && hour < 21) return 1.1;
  return 1.25; // 21–04
}

/** Europe/Berlin offset (CET/CEST) without Intl time zone data. */
export function hamburgOffset(ts: number): number {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(y, month + 1, 0));
    return Date.UTC(y, month, last.getUTCDate() - last.getUTCDay(), 1);
  };
  return ts >= lastSunday(2) && ts < lastSunday(9) ? 120 : 60;
}

/** Hamburg wall-clock hour as a fraction (21.5 = 21:30). */
export function hamburgHour(ts: number): number {
  const d = new Date(ts + hamburgOffset(ts) * 60_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/**
 * Where someone should be right now, from their personality: asleep → offline
 * (always-on people just idle), in their active hours → online (now and then
 * idle), awake but off-hours → mostly idle. Stable per person per 20 minutes,
 * and everyone's day shifts by up to ±45 minutes, so nobody flips on the hour.
 */
export function presenceTarget(userId: string, ts: number): Presence | null {
  const p = PROFILE.get(userId)?.personality;
  if (!p) return null;
  const day = Math.floor((ts + hamburgOffset(ts) * 60_000) / 86_400_000);
  const h = (hamburgHour(ts) + (stableRand(`${userId}:${day}`) - 0.5) * 1.5 + 24) % 24;
  const r = stableRand(`${userId}:${Math.floor(ts / (20 * 60_000))}`);
  const busy: Presence = SEED_PRESENCE.get(userId) === "dnd" ? "dnd" : "online";
  if (inHours(h, p.sleepHours)) return p.alwaysOn ? "idle" : "offline";
  if (inHours(h, p.activeHours)) return r < 0.85 ? busy : "idle";
  return r < 0.3 ? busy : "idle";
}

/** Expected messages per minute at a given activity (used to size catch-up). */
export function expectedPerMinute(activity: number): number {
  return 11 * activity;
}

/** Expected messages in a window, following the time-of-day curve. */
export function expectedMessages(activity: number, from: number, to: number): number {
  let n = 0;
  for (let t = from; t < to; t += 5 * 60_000) n += expectedPerMinute(activity) * timeOfDayFactor(t) * (Math.min(to, t + 5 * 60_000) - t) / 60_000;
  return n;
}

/** A short quotable fragment of an earlier line ("has anyone seen my…"). */
export function fragment(text: string): string {
  const t = text.replace(EMOJI_RE, "").replace(/@(\w+)/g, "$1").replace(/["“”„*]/g, "").replace(/\s+/g, " ").trim();
  const clause = t.split(/[.!?…,—:\n]/)[0]!.trim();
  const words = (clause.split(" ").length >= 3 ? clause : t).split(" ").filter(Boolean);
  const cut = words.length > 6;
  return lowerChat(words.slice(0, 6).join(" ")).replace(/[,.;:!?—-]+$/, "") + (cut ? "…" : "");
}

/** One reaction emoji: often the person's favourite, otherwise one that fits the line. */
function reactionEmoji(by: User | undefined, m: Message, rng: Rng): string {
  const fav = by ? personaOf(by.id).emoji.map((e) => e.match(EMOJI_RE)?.[0]).filter((e): e is string => !!e) : [];
  if (fav.length && rng() < 0.45) return fav[0]!;
  const tag = m.isHuman ? (m.channelId === "c_intros" ? "greet" : "human") : (m.simTag ?? "").split(":")[0]!;
  return pick(REACTIONS[tag] ?? REACTIONS.default!, rng);
}

let seq = 0;

export class Planner {
  events: FloorEvent[] = [];
  private parsed: ParsedPrompt;
  private eff: ReturnType<typeof effective>;

  constructor(
    private world: World,
    public state: PlannerState,
  ) {
    this.parsed = parsePrompt(world.settings.prompt);
    this.eff = effective(world.settings, this.parsed);
  }

  private get rng() {
    return this.world.rng;
  }
  private muted(id: string) {
    return (this.world.settings.muted ?? []).includes(id);
  }
  private npcs(): User[] {
    return [...this.world.users.values()].filter((u) => u.isNpc && !this.muted(u.id));
  }
  private channel(id: string): Message[] {
    let list = this.world.recent.get(id);
    if (!list) this.world.recent.set(id, (list = []));
    return list;
  }

  /* ── choices ── */

  pickChannel(): string {
    return (
      weightedPick(
        Object.entries(SIM_CHANNEL_WEIGHTS).map(([id, w]) => [id, id === this.world.focusChannel ? w * 2 : w] as [string, number]),
        this.rng,
      ) ?? "c_general"
    );
  }

  /** Whoever just posted twice in a row in this channel (they sit the next one out). */
  private twoInRow(channelId: string, at: number): string | null {
    const recent = this.channel(channelId)
      .filter((m) => m.createdAt <= at)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-2);
    return recent.length === 2 && recent[0]!.authorId === recent[1]!.authorId ? recent[0]!.authorId : null;
  }

  /** People still typing / with a message queued at `at` — nobody types two messages at once. */
  private busy(at: number): Set<string> {
    const out = new Set<string>();
    for (const list of this.world.recent.values()) {
      for (let i = list.length - 1; i >= Math.max(0, list.length - 40); i--) {
        const m = list[i]!;
        if (m.createdAt > at && m.createdAt - 20_000 <= at) out.add(m.authorId);
      }
    }
    return out;
  }

  /** How likely someone writes at `at`: their active hours, presence and how chatty they are. */
  private authorWeight(u: User, at: number): number {
    const p = personaOf(u.id);
    const active = inHours(hamburgHour(at), p.activeHours) ? 2 : 0.6;
    const presence = u.presence === "online" ? 1 : u.presence === "dnd" ? 0.5 : u.presence === "idle" ? 0.45 : 0;
    return active * presence * (0.6 + p.chattiness);
  }

  pickAuthor(channelId: string, at: number, exclude: string[] = []): User | undefined {
    const twoInRow = this.twoInRow(channelId, at);
    const busy = this.busy(at);
    const pool = this.npcs().filter((u) => u.id !== twoInRow && !busy.has(u.id) && !exclude.includes(u.id) && u.presence !== "offline");
    let author = weightedPick(
      pool.map((u) => [u, this.authorWeight(u, at)] as [User, number]),
      this.rng,
    );
    if (!author || this.rng() < 0.03) {
      // Someone offline picks up their phone — usually someone who's awake.
      const offline = this.npcs().filter((u) => u.presence === "offline" && !exclude.includes(u.id) && u.id !== twoInRow && !busy.has(u.id));
      const awake = offline.filter((u) => presenceTarget(u.id, at) !== "offline");
      const from = awake.length ? awake : this.rng() < 0.15 ? offline : [];
      if (from.length) {
        const u = pick(from, this.rng);
        this.patchUser(u.id, { presence: "online" }, at);
        author = this.world.users.get(u.id);
      }
    }
    return author;
  }

  /**
   * Uniqueness window (spec: "ban duplicate strings in last N messages per channel"):
   * the channel's last 60 messages + the last 200 lines anywhere; near-duplicates are
   * checked against the channel's last 40 and the last 40 anywhere.
   */
  private uniquenessWindow(channelId: string) {
    const local = this.channel(channelId).slice(-60);
    const global = this.world.texts.slice(-200);
    const recent = new Set<string>();
    for (const m of local) {
      recent.add(uniqKey(m.content));
      if (m.i18n) recent.add(uniqKey(m.i18n.en)), recent.add(uniqKey(m.i18n.de));
    }
    for (const t of global) recent.add(uniqKey(t));
    const texts = [...local.slice(-40).map((m) => m.i18n?.en ?? m.content), ...global.slice(-40)];
    return { recent, texts };
  }

  private compose(
    category: Category,
    author: User,
    channelId: string,
    replyToName?: string,
    extra: { gag?: GagId; quote?: { en: string; de: string }; at?: number } = {},
  ): Composed | null {
    const window = this.uniquenessWindow(channelId);
    const c = composeLine({
      category,
      settings: this.world.settings,
      parsed: this.parsed,
      author,
      profile: PROFILE.get(author.id),
      lang: "de", // compute both versions; the mix (`de`) follows each persona's German ratio
      channelId,
      replyToName,
      otherNames: [...this.world.users.values()].filter((u) => u.isNpc).map((u) => u.displayName),
      recent: window.recent,
      avoid: this.state.templates,
      recentTexts: window.texts,
      gag: extra.gag,
      quote: extra.quote,
      now: extra.at,
      rng: this.rng,
    });
    if (c) {
      this.state.templates.unshift(c.template);
      this.state.templates.length = Math.min(this.state.templates.length, 110);
      if (c.gag) (this.state.gags ??= {})[c.gag] = extra.at ?? Date.now();
    }
    return c;
  }

  private composeAny(category: Category, author: User, channelId: string, replyToName?: string, extra: { gag?: GagId; at?: number } = {}): Composed | null {
    return (
      this.compose(category, author, channelId, replyToName, extra) ??
      this.compose("topic", author, channelId, replyToName, extra) ??
      this.compose(this.rng() < 0.5 ? "laugh" : "agree", author, channelId, replyToName, extra)
    );
  }

  /** Which running gag comes up: the owners' favourites, not one that was just mentioned, roasty ones fade at high glaze. */
  private pickGag(authorId: string, at: number): GagId {
    const items = (Object.keys(GAGS) as GagId[]).map((id) => {
      const g = GAGS[id];
      const last = this.state.gags?.[id];
      const recent = last !== undefined && at - last < 8 * 60_000;
      return [id, g.weight * (g.owners.includes(authorId) ? 2.5 : 1) * (recent ? 0.35 : 1) * (g.roasty ? 1 - 0.75 * this.eff.glaze : 1)] as [GagId, number];
    });
    return weightedPick(items, this.rng) ?? "jacket";
  }

  /** An earlier line worth quoting back: 90 s – 4 h old, someone else's, preferably in this channel. */
  private quoteSource(channelId: string, authorId: string, at: number): Message | null {
    const pool: Array<[Message, number]> = [];
    for (const [ch, list] of this.world.recent) {
      for (const m of list) {
        if (m.authorId === authorId || m.authorId === "u_doorman" || m.createdAt > at - 90_000 || m.createdAt < at - 4 * 3600_000) continue;
        if (!m.isHuman && !this.world.users.get(m.authorId)?.isNpc) continue;
        if (m.simTag === "callback" || m.simTag === "fix" || m.simTag === "system") continue;
        if ((m.i18n?.en ?? m.content).split(/\s+/).length < 4) continue;
        pool.push([m, ch === channelId ? 3 : 1]);
      }
    }
    return weightedPick(pool, this.rng) ?? null;
  }

  private findMessage(id: string): Message | null {
    for (const list of this.world.recent.values()) {
      const m = list.find((x) => x.id === id);
      if (m) return m;
    }
    return null;
  }

  private available(id: string, at: number, notIds: Array<string | null>, busy: Set<string>): boolean {
    const u = this.world.users.get(id);
    return !!u && u.isNpc && !this.muted(id) && u.presence !== "offline" && !notIds.includes(id) && !busy.has(id) && presenceTarget(id, at) !== "offline";
  }

  /** Decide + compose one post at time `at` (typing starts at `at`) — or a reaction instead of a reply. */
  draft(channelId: string, at: number, opts: { threadTo?: Message | null; replyChance: number; noReact?: boolean }): DraftResult {
    const visible = this.channel(channelId).filter((m) => m.createdAt <= at);
    let replyTo: Message | undefined;
    if (this.rng() < opts.replyChance) {
      if (opts.threadTo && this.rng() < 0.7) replyTo = opts.threadTo;
      else {
        const recent = visible.slice(-6).filter((m) => at - m.createdAt < 3 * 3600_000 && m.simTag !== "fix");
        replyTo = recent.length ? weightedPick(recent.map((m, i) => [m, i + 1] as [Message, number]), this.rng) : undefined;
      }
    }
    const twoInRow = this.twoInRow(channelId, at);
    let author: User | undefined;
    let relation: "friend" | "rival" | undefined;
    if (replyTo) {
      const target = replyTo.authorId;
      const tp = PROFILE.get(target)?.personality;
      const notIds = [target, twoInRow];
      const busy = this.busy(at);
      const relOf = (id: string): typeof relation => {
        const p = personaOf(id);
        if (p.rivals.includes(target) || tp?.rivals.includes(id)) return "rival";
        if (p.friends.includes(target) || tp?.friends.includes(id) || PROFILE.get(id)?.relationships.includes(target)) return "friend";
        return undefined;
      };
      // Conversations go back and forth: whoever was answered often answers back.
      const parent = replyTo.replyToId ? this.findMessage(replyTo.replyToId) : null;
      if (parent && parent.authorId !== target && this.available(parent.authorId, at, notIds, busy) && this.rng() < 0.3) {
        author = this.world.users.get(parent.authorId);
      } else {
        const ids = NPC_PROFILES.map((p) => p.userId).filter((id) => this.available(id, at, notIds, busy));
        const rivals = ids.filter((id) => relOf(id) === "rival");
        const friends = ids.filter((id) => relOf(id) === "friend");
        // Rivals bicker (more with drama); friends back each other up.
        if (rivals.length && this.eff.drama > 0 && this.rng() < 0.04 + 0.45 * this.eff.drama) author = this.world.users.get(pick(rivals, this.rng));
        else if (friends.length && this.rng() < 0.55) author = this.world.users.get(pick(friends, this.rng));
      }
      if (author) relation = relOf(author.id);
    }
    author ??= this.pickAuthor(channelId, at, replyTo ? [replyTo.authorId] : []);
    if (!author) return null;
    if (replyTo) relation ??= personaOf(author.id).rivals.includes(replyTo.authorId) ? "rival" : undefined;

    // Some people just react instead of writing.
    if (replyTo && !opts.noReact && this.rng() < personaOf(author.id).reactRate * 0.5) {
      return { react: { messageId: replyTo.id, emoji: reactionEmoji(author, replyTo, this.rng), author } };
    }

    const replyAuthor = replyTo ? this.world.users.get(replyTo.authorId) : undefined;
    const hasTopics = this.parsed.topics.length > 0;
    const parentGag = replyTo?.simTag?.startsWith("lore:") ? (replyTo.simTag.slice(5) as GagId) : undefined;
    let category: Category;
    if (!replyTo) category = freshCategory(this.world.settings, this.eff, hasTopics, this.rng, { lore: true, callback: true });
    else if (replyAuthor?.roleId === "owner") category = ownerReplyCategory(this.eff, this.rng);
    else if (relation === "rival" && this.eff.drama > 0.02 && this.rng() < 0.25 + 0.6 * this.eff.drama) category = "bicker";
    else if (relation === "friend" && this.rng() < 0.3) category = "friend";
    else if (parentGag && this.rng() < 0.4) category = "lore";
    else if (this.rng() < 0.45) category = replyCategory(this.eff, replyTo.simTag, this.rng);
    else if (ELIAS_TAGS.has(replyTo.simTag ?? "") && this.rng() < 0.7) category = eliasCategory(this.eff.glaze, this.rng);
    else if (replyTo.simTag === "prompt" && hasTopics && this.rng() < 0.6) category = "prompt";
    else category = freshCategory(this.world.settings, this.eff, hasTopics, this.rng, { lore: true });

    let c: Composed | null = null;
    let replyToId = replyTo?.id;
    if (category === "callback") {
      // "what mara said earlier about …": quote a fragment of an earlier line.
      const src = this.quoteSource(channelId, author.id, at);
      if (src) {
        const en = fragment(src.i18n?.en ?? src.content);
        const de = fragment(src.i18n?.de ?? src.content);
        const name = this.world.users.get(src.authorId)?.displayName ?? "someone";
        if (en.split(" ").length >= 2) c = this.compose("callback", author, channelId, name, { quote: { en, de }, at });
        if (c && src.channelId === channelId && this.rng() < 0.5) replyToId = src.id;
      }
      category = "topic";
    }
    if (!c && category === "lore") c = this.compose("lore", author, channelId, replyAuthor?.displayName, { gag: parentGag ?? this.pickGag(author.id, at), at });
    c ??= this.composeAny(category === "lore" ? "topic" : category, author, channelId, replyAuthor?.displayName, { at });
    return c ? { c, author, replyToId } : null;
  }

  /**
   * Turn a draft into messages: 1–3 in a row (+ maybe a typo fix), each with
   * its own typing window. Typing time follows the author's typing speed.
   * Returns the first message (the one that answers / starts the thread).
   */
  post(channelId: string, d: Draft, at: number, opts: { past?: boolean; quick?: boolean; human?: boolean; firstTyping?: number } = {}): Message {
    const persona = personaOf(d.author.id);
    // Right after their own message, people don't fire off another 2–3 in a row (and a Backstage burst is one line each).
    const solo =
      d.c.parts.length > 1 &&
      (!!opts.quick || (!opts.human && this.channel(channelId).some((m) => m.authorId === d.author.id && m.createdAt >= at - 60_000)));
    const seqParts: Array<{ p: ComposedPart; fix: boolean }> = solo ? [{ p: d.c, fix: false }] : d.c.parts.map((p) => ({ p, fix: false }));
    if (d.c.fix && !solo) seqParts.splice(d.c.fix.after + 1, 0, { p: d.c.fix, fix: true });
    const tag = d.c.gag ? `lore:${d.c.gag}` : d.c.category;
    const group = `g${(seq++).toString(36)}${Math.floor(this.rng() * 1e6).toString(36)}`;
    let head: Message | null = null;
    let prevAt = at;
    seqParts.forEach((item, i) => {
      let typing = 0;
      if (!opts.past) {
        typing = i === 0 && opts.firstTyping !== undefined ? opts.firstTyping : this.typingFor(item.p.mix, persona, opts);
        if (item.fix) typing = Math.min(typing, 1600);
      }
      const start = i === 0 ? at : prevAt + (opts.past ? rand(this.rng, 1500, 8000) : opts.quick ? rand(this.rng, 150, 600) : item.fix ? rand(this.rng, 700, 3500) : rand(this.rng, 250, 1800));
      const createdAt = Math.round(start + typing);
      prevAt = createdAt;
      const message: Message = {
        id: `m_sim_${createdAt.toString(36)}_${(seq++).toString(36)}${Math.floor(this.rng() * 1e6).toString(36)}`,
        channelId,
        authorId: d.author.id,
        content: item.p.mix,
        i18n: { en: item.p.en, de: item.p.mix },
        createdAt,
        replyToId: i === 0 ? d.replyToId : undefined,
        simTag: item.fix ? "fix" : tag,
      };
      this.channel(channelId).push(message);
      this.world.texts.push(item.p.en);
      this.events.push({ kind: "message", message, typingMs: Math.round(typing), group, part: i, ...(i === 0 && seqParts.length > 1 ? { whole: { en: d.c.en, de: d.c.de, mix: d.c.mix } } : {}) });
      head ??= message;
    });
    return head!;
  }

  /** Typing time for one message. Humans get the real thing; the background floor types a bit faster on busy settings. */
  private typingFor(text: string, persona: NpcPersonality, opts: { quick?: boolean; human?: boolean }): number {
    let ms = typingMs(text, persona, this.rng);
    if (opts.human) return clamp(ms, 900, 20_000);
    ms /= Math.sqrt(Math.max(0.5, this.world.settings.activity));
    if (opts.quick) ms = Math.min(ms, 2200);
    return Math.round(clamp(ms, 600, 12_000));
  }

  patchUser(id: string, patch: Partial<User>, at: number) {
    const u = this.world.users.get(id);
    if (!u) return;
    this.world.users.set(id, { ...u, ...patch });
    this.events.push({ kind: "user", userId: id, patch, at });
  }

  private addReaction(m: Message, emoji: string, at: number, by?: string, instead?: boolean) {
    const existing = m.reactions?.filter((r) => r.count > 0) ?? [];
    m.reactions = [...existing.filter((r) => r.emoji !== emoji), { emoji, count: (existing.find((r) => r.emoji === emoji)?.count ?? 0) + 1, me: false }];
    this.events.push({ kind: "reaction", messageId: m.id, emoji, at: Math.round(at), by, instead });
  }

  react(at: number) {
    const channelId = this.pickChannel();
    const recent = this.channel(channelId).filter((m) => m.createdAt <= at).slice(-8);
    if (!recent.length) return;
    const m = pick(recent, this.rng);
    const existing = m.reactions?.filter((r) => r.count > 0) ?? [];
    const emoji = existing.length && this.rng() < 0.55 ? pick(existing, this.rng).emoji : reactionEmoji(undefined, m, this.rng);
    this.addReaction(m, emoji, at);
  }

  voiceFlip(at: number) {
    const users = this.npcs();
    const inVoice = users.filter((u) => u.voiceChannelId && !u.selfDeaf);
    if (inVoice.length && this.rng() < 0.75) {
      const u = pick(inVoice, this.rng);
      this.patchUser(u.id, { speaking: !u.speaking && !u.selfMute }, at);
      return;
    }
    if (this.rng() < 0.5 && inVoice.length > 2) {
      this.patchUser(pick(inVoice, this.rng).id, { voiceChannelId: undefined, speaking: false }, at);
    } else {
      const free = users.filter((u) => !u.voiceChannelId && u.presence === "online");
      if (free.length) this.patchUser(pick(free, this.rng).id, { voiceChannelId: pick(VOICE, this.rng), speaking: false }, at);
    }
  }

  /** Someone awake looks at their phone / puts it down (online ↔ idle). Asleep people stay asleep. */
  presenceFlip(at: number) {
    const awake = this.npcs().filter((u) => u.presence !== "offline" && u.presence !== "dnd" && !u.voiceChannelId);
    if (!awake.length) return;
    const u = pick(awake, this.rng);
    this.patchUser(u.id, { presence: u.presence === "online" ? "idle" : "online" }, at);
  }

  /**
   * Presence follows everyone's day (Hamburg time): every 20 s, people whose
   * presence doesn't match their hours drift toward it — a few at a time, so the
   * member list changes gradually. After a long gap everything is put right at once.
   */
  presenceSync(at: number) {
    const last = this.state.presenceAt ?? 0;
    if (at - last < 20_000) return;
    const full = at - last > 30 * 60_000;
    this.state.presenceAt = at;
    for (const u of this.world.users.values()) {
      if (!u.isNpc) continue;
      const target = presenceTarget(u.id, at);
      if (!target || u.presence === target) continue;
      // Online ↔ idle drifts quickly; going to bed / waking up happens over a few minutes.
      const chance = target === "offline" || u.presence === "offline" ? 0.12 : 0.3;
      if (!full && this.rng() > chance) continue;
      this.patchUser(u.id, target === "offline" && u.voiceChannelId ? { presence: target, voiceChannelId: undefined, speaking: false } : { presence: target }, at);
    }
  }

  /* ── the clock ── */

  /**
   * Advance the floor from `from` to `to`. `density` < 1 thins the floor out
   * (catch-up after long absences); `past` marks backfilled history (no typing).
   */
  advance(from: number, to: number, opts: { density?: number; past?: boolean; maxMessages?: number } = {}) {
    const density = Math.max(0.02, opts.density ?? 1);
    let posted = 0;
    let t = Math.max(this.state.nextStepAt, from);
    const thread = () => (this.state.threadId ? this.findMessage(this.state.threadId) : null);
    while (t <= to) {
      if (opts.maxMessages !== undefined && posted >= opts.maxMessages) {
        t = to + 1;
        break;
      }
      const a = this.world.settings.activity * timeOfDayFactor(t);
      this.presenceSync(t);
      if (this.rng() < 0.2) this.react(t);
      if (!opts.past && this.rng() < 0.12) this.voiceFlip(t);
      if (this.rng() < 0.02) this.presenceFlip(t);

      if (this.state.flurryLeft <= 0) {
        this.state.flurryLeft = 3 + Math.floor(this.rng() * 4) + Math.floor(Math.max(0, this.world.settings.activity - 1));
        this.state.flurryChannel = this.pickChannel();
        this.state.threadId = null;
      }
      const ch = this.state.flurryChannel;
      const tm = thread();
      const forced = !!tm && (this.state.warm ?? 0) > 0;
      const d = this.draft(ch, t, { threadTo: tm, replyChance: forced ? 1 : tm ? 0.72 : 0.45, noReact: forced });
      if (forced && d) this.state.warm = (this.state.warm ?? 1) - 1;
      if (d && "react" in d) {
        const m = this.findMessage(d.react.messageId);
        if (m) this.addReaction(m, d.react.emoji, t + rand(this.rng, 800, 4000), d.react.author.id, true);
      } else if (d) {
        const quick = (this.state.fast ?? 0) > 0;
        if (quick) this.state.fast = this.state.fast! - 1;
        this.state.threadId = this.post(ch, d, t, { past: opts.past, quick }).id;
        posted++;
      }
      this.state.flurryLeft--;
      if (a > 1.6 && this.rng() < (a - 1.6) / 2) {
        const other = this.pickChannel();
        const d2 = other !== ch ? this.draft(other, t, { replyChance: 0.45, noReact: true }) : null;
        if (d2 && !("react" in d2)) {
          this.post(other, d2, t + 300, { past: opts.past });
          posted++;
        }
      }
      const gap = this.state.flurryLeft > 0 ? rand(this.rng, 1500, 4800) : rand(this.rng, 5000, 20000);
      t += gap / (a * density);
    }
    this.state.nextStepAt = t;
    return posted;
  }

  /**
   * A human just posted. Usually 0–2 people write back (rarely 3), each after
   * 2–40 s with a typing indicator first; some just react; whoever's named in
   * the message almost always answers; sometimes nobody does at all.
   */
  replyToHuman(human: Message, now: number) {
    const rng = this.rng;
    const author = this.world.users.get(human.authorId);
    const isOwner = author?.roleId === "owner";
    const intro = human.channelId === "c_intros";
    const a = this.world.settings.activity;
    const text = human.content;
    const question = /\?/.test(text) || /^(who|what|when|where|why|how|anyone|does|do|is|are|can|should|wer|was|wann|wo|warum|wieso|wie|kommt|hat|habt|ist|seid|kann)\b/i.test(text.trim());
    const mentioned = this.npcs().filter((u) =>
      new RegExp(`(^|[^\\p{L}])@?(${escapeRe(u.displayName)}|${escapeRe(u.username)})($|[^\\p{L}])`, "iu").test(text),
    );

    // How many write back.
    let n: number;
    if (!isOwner) n = intro ? (rng() < 0.05 ? 0 : rng() < 0.85 ? 1 : 2) : rng() < 0.3 ? 0 : 1;
    else {
      const w = question ? [0.08, 0.42, 0.36, 0.14] : [0.18, 0.45, 0.28, 0.09];
      const shift = clamp((a - 1) * 0.08, -0.08, 0.1); // busier floor → more answers
      w[0] = Math.max(0.03, w[0]! - shift);
      w[2] = w[2]! + shift * 0.6;
      w[3] = w[3]! + shift * 0.4;
      n = weightedPick(w.map((x, i) => [i, x] as [number, number]), rng) ?? 1;
    }
    n = Math.min(3, Math.max(n, Math.min(mentioned.length, 2)));

    // Who: people who are around, chatty, into the topic — and whoever was named.
    const words = text.toLowerCase();
    const weightOf = (u: User) => {
      const p = personaOf(u.id);
      const presence = u.presence === "online" ? 1 : u.presence === "dnd" ? 0.35 : u.presence === "idle" ? 0.4 : 0.03;
      const active = inHours(hamburgHour(now), p.activeHours) ? 1.3 : 0.7;
      const interest = p.interests.some((i) => words.includes(i.toLowerCase())) ? 2 : 1;
      const fan = isOwner && PROFILE.get(u.id)?.eliasOpinion === "fan" ? 1.2 : 1;
      return presence * active * interest * fan * (0.3 + p.chattiness);
    };
    const chosen: User[] = mentioned.slice(0, 3);
    while (chosen.length < n) {
      const u = weightedPick(this.npcs().filter((x) => !chosen.includes(x)).map((x) => [x, weightOf(x)] as [User, number]), rng);
      if (!u) break;
      chosen.push(u);
    }

    const heads: Message[] = [];
    let lastStart = now;
    chosen.forEach((npc, i) => {
      const p = personaOf(npc.id);
      const named = mentioned.includes(npc);
      // Read delay: idle people and lurkers take longer; later answers come after the first.
      let delay = npc.presence === "online" || npc.presence === "dnd" ? rand(rng, 1500, 14_000) : rand(rng, 6000, 24_000);
      if (p.chattiness < 0.45) delay += rand(rng, 0, 6000);
      if (i > 0) delay = Math.max(delay, lastStart - now + rand(rng, 1500, 9000));
      delay /= Math.pow(Math.max(0.5, a), 0.25);
      if (npc.presence === "offline") this.patchUser(npc.id, { presence: "online" }, now + delay * 0.5);

      // Reacting instead of writing (a newcomer saying hi gets at least one real welcome).
      if (!named && !(intro && i === 0) && rng() < p.reactRate * 0.6) {
        this.addReaction(human, reactionEmoji(npc, human, rng), now + clamp(delay, HUMAN_REPLY_MIN_MS, HUMAN_REPLY_MAX_MS - 1000), npc.id, true);
        return;
      }

      // Later answers sometimes riff on the first one instead of the human.
      const onFirst = heads.length && rng() < 0.3 ? heads[0]! : null;
      let c: Composed | null;
      if (onFirst) {
        const first = this.world.users.get(onFirst.authorId);
        const rival = p.rivals.includes(onFirst.authorId);
        const cat: Category = rival && this.eff.drama > 0.02 && rng() < 0.3 + 0.5 * this.eff.drama ? "bicker" : p.friends.includes(onFirst.authorId) && rng() < 0.4 ? "friend" : replyCategory(this.eff, onFirst.simTag, rng);
        c = this.composeAny(cat, npc, human.channelId, first?.displayName, { at: now });
      } else {
        const cat: Category = !isOwner ? (intro || rng() < 0.4 ? "greet" : "short") : humanReplyCategory(this.eff, question || named, rng);
        c = this.composeAny(cat, npc, human.channelId, isOwner ? "elias" : author?.displayName, { at: now });
      }
      if (!c) return;
      const firstTyping = clamp(typingMs(c.parts[0]!.mix, p, rng), 900, 20_000);
      // First message lands 2–40 s after the human's post, typing visible before it.
      let start = now + delay;
      if (start + firstTyping > now + HUMAN_REPLY_MAX_MS) start = Math.max(now + 300, now + HUMAN_REPLY_MAX_MS - firstTyping - rand(rng, 0, 3000));
      if (start + firstTyping < now + HUMAN_REPLY_MIN_MS) start = now + HUMAN_REPLY_MIN_MS - firstTyping;
      lastStart = start;
      const head = this.post(human.channelId, { c, author: npc, replyToId: onFirst ? onFirst.id : human.id }, start, { human: true, firstTyping });
      heads.push(head);
    });

    // A few bystanders leave a reaction (people who didn't write).
    const extra = isOwner ? (rng() < 0.35 ? 1 + (rng() < 0.3 ? 1 : 0) : 0) : rng() < 0.3 ? 1 : 0;
    for (let k = 0; k < extra; k++) {
      const by = weightedPick(this.npcs().filter((u) => !chosen.includes(u) && u.presence !== "offline").map((u) => [u, weightOf(u) * (0.3 + personaOf(u.id).reactRate)] as [User, number]), rng);
      if (!by) break;
      chosen.push(by);
      this.addReaction(human, reactionEmoji(by, human, rng), now + rand(rng, 2500, 38_000), by.id, false);
    }
  }

  /** Backstage "Start a burst": six quick messages in one channel. */
  burst(channelId: string, now: number) {
    let threadMsg: Message | null = null;
    let at = now;
    let posted = 0;
    for (let attempt = 0; attempt < 14 && posted < 6; attempt++) {
      at += rand(this.rng, 500, 1100);
      const d = this.draft(channelId, at, { threadTo: threadMsg, replyChance: 0.6, noReact: true });
      if (!d || "react" in d) continue;
      threadMsg = this.post(channelId, d, at, { quick: true });
      posted++;
    }
  }
}
