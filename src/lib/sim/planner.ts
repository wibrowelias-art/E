/**
 * Floor planner (Phase 3): pure, clock-free simulation logic shared by the
 * server tick. Given a world snapshot and a time window it returns the events
 * that happen in that window — messages (with typing time), reactions, voice /
 * presence changes. No timers, no I/O: the server persists the events, and
 * tests can run hours of floor in milliseconds.
 */
import { NPC_PROFILES } from "@/data/npcs";
import type { Message, SimSettings, User } from "@/lib/types";
import type { Category } from "./banks";
import {
  composeLine,
  effective,
  eliasCategory,
  freshCategory,
  ownerReplyCategory,
  parsePrompt,
  replyCategory,
  uniqKey,
  type Composed,
  type ParsedPrompt,
  type Rng,
} from "./brain";

export const SIM_CHANNEL_WEIGHTS: Record<string, number> = {
  c_general: 30,
  c_hhnight: 16,
  c_glaze: 14,
  c_photo: 10,
  c_build: 10,
  c_random: 10,
  c_memes: 8,
};
const VOICE = ["c_vc_main", "c_vc_after"];
const ELIAS_TAGS = new Set(["worship", "praise", "mild", "critical", "roast", "ownerPos", "ownerNeg"]);
const PROFILE = new Map(NPC_PROFILES.map((p) => [p.userId, p]));
const REACTIONS: Record<string, string[]> = {
  worship: ["🔥", "✨", "🖤", "🙌", "📸"],
  praise: ["🔥", "✨", "🖤", "💯"],
  roast: ["💀", "😬", "👀", "😂"],
  critical: ["👀", "😬", "💯"],
  drama: ["👀", "🍿", "😳"],
  laugh: ["😭", "💀"],
  wholesome: ["🖤", "🥹", "🫶"],
  greet: ["👋", "🖤"],
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
}

export function initialPlannerState(now: number): PlannerState {
  return { nextStepAt: now + 800, flurryLeft: 5, flurryChannel: "c_general", threadId: null, templates: [], warm: 1 };
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
  | { kind: "message"; message: Message; typingMs: number }
  | { kind: "reaction"; messageId: string; emoji: string; at: number }
  | { kind: "user"; userId: string; patch: Partial<User>; at: number };

const rand = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;

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

function hourWeight(activity: string | undefined, hour: number): number {
  const night = hour >= 20 || hour < 4;
  const morning = hour >= 6 && hour < 11;
  const evening = hour >= 17;
  switch (activity) {
    case "night-owl":
      return night ? 2.2 : morning ? 0.4 : 1;
    case "morning-lurker":
      return morning ? 2.4 : night ? 0.35 : 0.8;
    case "evening":
      return evening ? 1.8 : morning ? 0.6 : 1;
    default:
      return 1.2;
  }
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
      .filter((m) => m.createdAt <= at + 15_000)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-2);
    return recent.length === 2 && recent[0]!.authorId === recent[1]!.authorId ? recent[0]!.authorId : null;
  }

  pickAuthor(channelId: string, at: number, exclude: string[] = []): User | undefined {
    const twoInRow = this.twoInRow(channelId, at);
    const hour = new Date(at + hamburgOffset(at) * 60_000).getUTCHours();
    const pool = this.npcs().filter((u) => u.id !== twoInRow && !exclude.includes(u.id) && u.presence !== "offline");
    let author = weightedPick(
      pool.map((u) => [u, hourWeight(PROFILE.get(u.id)?.activity, hour) * (u.presence === "idle" ? 0.5 : 1)] as [User, number]),
      this.rng,
    );
    if (!author || this.rng() < 0.03) {
      const offline = this.npcs().filter((u) => u.presence === "offline" && !exclude.includes(u.id) && u.id !== twoInRow);
      if (offline.length) {
        const u = pick(offline, this.rng);
        this.patchUser(u.id, { presence: "online" }, at);
        author = this.world.users.get(u.id);
      }
    }
    return author;
  }

  /**
   * Uniqueness window (spec: "ban duplicate strings in last N messages per channel"):
   * the channel's last 60 messages + the last 100 lines anywhere; near-duplicates are
   * checked against the channel's last 40 and the last 40 anywhere.
   */
  private uniquenessWindow(channelId: string) {
    const local = this.channel(channelId).slice(-60);
    const global = this.world.texts.slice(-100);
    const recent = new Set<string>();
    for (const m of local) {
      recent.add(uniqKey(m.content));
      if (m.i18n) recent.add(uniqKey(m.i18n.en)), recent.add(uniqKey(m.i18n.de));
    }
    for (const t of global) recent.add(uniqKey(t));
    const texts = [...local.slice(-40).map((m) => m.i18n?.en ?? m.content), ...global.slice(-40)];
    return { recent, texts };
  }

  private compose(category: Category, author: User, channelId: string, replyToName?: string): Composed | null {
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
      rng: this.rng,
    });
    if (c) {
      this.state.templates.unshift(c.template);
      this.state.templates.length = Math.min(this.state.templates.length, 110);
    }
    return c;
  }

  private composeAny(category: Category, author: User, channelId: string, replyToName?: string): Composed | null {
    return (
      this.compose(category, author, channelId, replyToName) ??
      this.compose("topic", author, channelId, replyToName) ??
      this.compose(this.rng() < 0.5 ? "laugh" : "agree", author, channelId, replyToName)
    );
  }

  /** Decide + compose one post at time `at` (typing starts at `at`). */
  draft(channelId: string, at: number, opts: { threadTo?: Message | null; replyChance: number }) {
    const visible = this.channel(channelId).filter((m) => m.createdAt <= at);
    let replyTo: Message | undefined;
    if (this.rng() < opts.replyChance) {
      if (opts.threadTo && this.rng() < 0.7) replyTo = opts.threadTo;
      else {
        const recent = visible.slice(-6).filter((m) => at - m.createdAt < 3 * 3600_000);
        replyTo = recent.length ? weightedPick(recent.map((m, i) => [m, i + 1] as [Message, number]), this.rng) : undefined;
      }
    }
    const exclude = replyTo ? [replyTo.authorId] : [];
    let author: User | undefined;
    if (replyTo) {
      const fans = NPC_PROFILES.filter((p) => p.relationships.includes(replyTo!.authorId) && !this.muted(p.userId)).map((p) => p.userId);
      const candidate = fans.length && this.rng() < 0.55 ? this.world.users.get(pick(fans, this.rng)) : undefined;
      if (candidate && candidate.presence !== "offline" && candidate.id !== replyTo.authorId && candidate.id !== this.twoInRow(channelId, at)) author = candidate;
    }
    author ??= this.pickAuthor(channelId, at, exclude);
    if (!author) return null;
    const replyAuthor = replyTo ? this.world.users.get(replyTo.authorId) : undefined;
    const hasTopics = this.parsed.topics.length > 0;
    const category: Category = replyTo
      ? replyAuthor?.roleId === "owner"
        ? ownerReplyCategory(this.eff, this.rng)
        : this.rng() < 0.45
          ? replyCategory(this.eff, replyTo.simTag, this.rng)
          : ELIAS_TAGS.has(replyTo.simTag ?? "") && this.rng() < 0.7
            ? eliasCategory(this.eff.glaze, this.rng)
            : replyTo.simTag === "prompt" && hasTopics && this.rng() < 0.6
              ? "prompt"
              : freshCategory(this.world.settings, this.eff, hasTopics, this.rng)
      : freshCategory(this.world.settings, this.eff, hasTopics, this.rng);
    const c = this.composeAny(category, author, channelId, replyAuthor?.displayName);
    return c ? { c, author, replyToId: replyTo?.id } : null;
  }

  /** Turn a draft into a message event (typing first, then the post). */
  post(channelId: string, d: NonNullable<ReturnType<Planner["draft"]>>, at: number, opts: { past?: boolean } = {}): Message {
    const activity = this.world.settings.activity;
    const typingMs = opts.past ? 0 : Math.round(Math.min(2500, Math.max(400, 350 + d.c.en.length * 28)) / Math.sqrt(Math.max(0.5, activity)));
    const createdAt = Math.round(at + typingMs);
    const message: Message = {
      id: `m_sim_${createdAt.toString(36)}_${(seq++).toString(36)}${Math.floor(this.rng() * 1e6).toString(36)}`,
      channelId,
      authorId: d.author.id,
      content: d.c.mix,
      i18n: { en: d.c.en, de: d.c.mix },
      createdAt,
      replyToId: d.replyToId,
      simTag: d.c.category,
    };
    this.channel(channelId).push(message);
    this.world.texts.push(d.c.en);
    this.events.push({ kind: "message", message, typingMs });
    return message;
  }

  patchUser(id: string, patch: Partial<User>, at: number) {
    const u = this.world.users.get(id);
    if (!u) return;
    this.world.users.set(id, { ...u, ...patch });
    this.events.push({ kind: "user", userId: id, patch, at });
  }

  react(at: number) {
    const channelId = this.pickChannel();
    const recent = this.channel(channelId).filter((m) => m.createdAt <= at).slice(-8);
    if (!recent.length) return;
    const m = pick(recent, this.rng);
    const tag = m.simTag && REACTIONS[m.simTag] ? m.simTag : "default";
    const existing = m.reactions?.filter((r) => r.count > 0) ?? [];
    const emoji = existing.length && this.rng() < 0.55 ? pick(existing, this.rng).emoji : pick(REACTIONS[tag]!, this.rng);
    m.reactions = [...existing.filter((r) => r.emoji !== emoji), { emoji, count: (existing.find((r) => r.emoji === emoji)?.count ?? 0) + 1, me: false }];
    this.events.push({ kind: "reaction", messageId: m.id, emoji, at });
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

  presenceFlip(at: number) {
    const all = this.npcs();
    if (!all.length) return;
    const u = pick(all, this.rng);
    if (u.voiceChannelId) return;
    this.patchUser(u.id, { presence: u.presence === "online" ? (this.rng() < 0.7 ? "idle" : "offline") : "online" }, at);
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
      if (this.rng() < 0.2) this.react(t);
      if (!opts.past && this.rng() < 0.12) this.voiceFlip(t);
      if (this.rng() < 0.025) this.presenceFlip(t);

      if (this.state.flurryLeft <= 0) {
        this.state.flurryLeft = 3 + Math.floor(this.rng() * 4) + Math.floor(Math.max(0, this.world.settings.activity - 1));
        this.state.flurryChannel = this.pickChannel();
        this.state.threadId = null;
      }
      const ch = this.state.flurryChannel;
      const tm = thread();
      const forced = !!tm && (this.state.warm ?? 0) > 0;
      const d = this.draft(ch, t, { threadTo: tm, replyChance: forced ? 1 : tm ? 0.65 : 0.4 });
      if (forced && d) this.state.warm = (this.state.warm ?? 1) - 1;
      if (d) {
        this.state.threadId = this.post(ch, d, t, { past: opts.past }).id;
        posted++;
      }
      this.state.flurryLeft--;
      if (a > 1.6 && this.rng() < (a - 1.6) / 2) {
        const other = this.pickChannel();
        const d2 = other !== ch ? this.draft(other, t, { replyChance: 0.45 }) : null;
        if (d2) {
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

  private findMessage(id: string): Message | null {
    for (const list of this.world.recent.values()) {
      const m = list.find((x) => x.id === id);
      if (m) return m;
    }
    return null;
  }

  /** A human just posted: 1–3 answers (owner) or a welcome (guest), scheduled from `now`. */
  replyToHuman(human: Message, now: number) {
    const author = this.world.users.get(human.authorId);
    const isOwner = author?.roleId === "owner";
    const a = this.world.settings.activity;
    if (!isOwner) {
      const npc = this.pickAuthor(human.channelId, now);
      if (!npc) return;
      const c = this.composeAny(human.channelId === "c_intros" || this.rng() < 0.4 ? "greet" : "agree", npc, human.channelId, author?.displayName);
      if (c) this.post(human.channelId, { c, author: npc, replyToId: human.id }, now + rand(this.rng, 1500, 3500) / Math.sqrt(a));
      return;
    }
    const replies = 1 + (this.rng() < 0.6 ? 1 : 0) + (this.rng() < 0.25 * a ? 1 : 0);
    let at = now + rand(this.rng, 900, 2600) / Math.sqrt(a);
    const used: string[] = [];
    for (let i = 0; i < replies; i++) {
      const npc = this.pickAuthor(human.channelId, at, used);
      if (!npc) break;
      used.push(npc.id);
      const category = i === 0 || this.rng() < 0.6 ? ownerReplyCategory(this.eff, this.rng) : replyCategory(this.eff, undefined, this.rng);
      const c = this.composeAny(category, npc, human.channelId, "elias");
      // The first answer always replies to the owner; later ones sometimes just talk.
      if (c) this.post(human.channelId, { c, author: npc, replyToId: i === 0 || this.rng() < 0.6 ? human.id : undefined }, at);
      at += rand(this.rng, 1600, 4200) / Math.sqrt(a);
    }
  }

  /** Backstage "Start a burst": six quick messages in one channel. */
  burst(channelId: string, now: number) {
    let threadMsg: Message | null = null;
    let at = now;
    let posted = 0;
    for (let attempt = 0; attempt < 14 && posted < 6; attempt++) {
      at += rand(this.rng, 500, 1100);
      const d = this.draft(channelId, at, { threadTo: threadMsg, replyChance: 0.6 });
      if (!d) continue;
      threadMsg = this.post(channelId, d, at);
      posted++;
    }
  }
}
