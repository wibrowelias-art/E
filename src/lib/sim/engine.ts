"use client";
/**
 * Client-side simulation clock (Phase 3 preview). Runs while the app is open,
 * reads Backstage settings on every tick (changes apply live), and backfills
 * history when you come back to the tab. Phase 3 moves this to a server tick
 * so the floor keeps moving with nobody watching.
 */
import { useEffect } from "react";
import { NPC_PROFILES } from "@/data/npcs";
import { useLounge } from "@/lib/store";
import type { Message, User } from "@/lib/types";
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

const CHANNEL_WEIGHTS: Record<string, number> = {
  c_general: 30,
  c_hhnight: 16,
  c_glaze: 14,
  c_photo: 10,
  c_build: 10,
  c_random: 10,
  c_memes: 8,
};
const VOICE = ["c_vc_main", "c_vc_after", "c_vc_afk"];
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
  default: ["😂", "🔥", "👀", "💯", "🫡", "😭"],
};

const rand = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]!;

let seq = 0;

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

export function useSimulation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const rng: Rng = Math.random;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (!stopped) fn();
      }, ms);
      timers.add(t);
    };
    const S = () => useLounge.getState();
    const npcIds = () => Object.values(S().users).filter((u) => u.isNpc && !(S().sim.muted ?? []).includes(u.id));
    const recentTemplates: string[] = [];

    const channelMessages = (channelId: string, n: number) => {
      const all = S().messages;
      const out: Message[] = [];
      for (let i = all.length - 1; i >= 0 && out.length < n; i--) if (all[i]!.channelId === channelId) out.push(all[i]!);
      return out; // newest first
    };

    const recentKeys = () => {
      const keys = new Set<string>();
      const all = S().messages;
      for (let i = Math.max(0, all.length - 300); i < all.length; i++) {
        const m = all[i]!;
        keys.add(uniqKey(m.content));
        if (m.i18n) keys.add(uniqKey(m.i18n.en)), keys.add(uniqKey(m.i18n.de));
      }
      return keys;
    };

    const pickChannel = () => {
      const current = S().channelByGuild[S().guildId];
      return (
        weightedPick(
          Object.entries(CHANNEL_WEIGHTS).map(([id, w]) => [id, id === current ? w * 2 : w] as [string, number]),
          rng,
        ) ?? "c_general"
      );
    };

    const pickAuthor = (channelId: string, exclude: string[] = []): User | undefined => {
      const recent = channelMessages(channelId, 2);
      const twoInRow = recent.length === 2 && recent[0]!.authorId === recent[1]!.authorId ? recent[0]!.authorId : null;
      const hour = new Date().getHours();
      const pool = npcIds().filter((u) => u.id !== twoInRow && !exclude.includes(u.id) && u.presence !== "offline");
      const author = weightedPick(
        pool.map((u) => [u, hourWeight(PROFILE.get(u.id)?.activity, hour) * (u.presence === "idle" ? 0.5 : 1)] as [User, number]),
        rng,
      );
      // Now and then someone offline comes online to say something.
      if (!author || rng() < 0.03) {
        const offline = npcIds().filter((u) => u.presence === "offline" && !exclude.includes(u.id));
        if (offline.length) {
          const u = pick(offline, rng);
          S().patchUser(u.id, { presence: "online" });
          return { ...u, presence: "online" };
        }
      }
      return author;
    };

    const compose = (category: Category, author: User, channelId: string, parsed: ParsedPrompt, replyToName?: string): Composed | null => {
      const st = S();
      const c = composeLine({
        category,
        settings: st.sim,
        parsed,
        author,
        profile: PROFILE.get(author.id),
        lang: st.lang,
        channelId,
        replyToName,
        otherNames: npcIds().map((u) => u.displayName),
        recent: recentKeys(),
        avoid: recentTemplates,
        recentTexts: S().messages.slice(-150).map((m) => m.i18n?.en ?? m.content),
        rng,
      });
      if (c) {
        recentTemplates.unshift(c.template);
        recentTemplates.length = Math.min(recentTemplates.length, 110);
      }
      return c;
    };
    /** Compose, falling back to other moods when one is exhausted (keeps lines unique). */
    const composeAny = (category: Category, author: User, channelId: string, parsed: ParsedPrompt, replyToName?: string): Composed | null =>
      compose(category, author, channelId, parsed, replyToName) ??
      compose("topic", author, channelId, parsed, replyToName) ??
      compose(rng() < 0.5 ? "laugh" : "agree", author, channelId, parsed, replyToName);

    const toMessage = (c: Composed, author: User, channelId: string, replyToId?: string, createdAt = Date.now()): Message => ({
      id: `m_sim_${createdAt}_${seq++}`,
      channelId,
      authorId: author.id,
      content: c.mix,
      i18n: { en: c.en, de: c.mix },
      createdAt,
      replyToId,
      simTag: c.category,
    });

    /** Decide + compose one post for a channel (no side effects). */
    const draft = (channelId: string, opts: { threadTo?: Message | null; replyChance: number }) => {
      const st = S();
      const parsed = parsePrompt(st.sim.prompt);
      const eff = effective(st.sim, parsed);
      let replyTo: Message | undefined;
      if (rng() < opts.replyChance) {
        if (opts.threadTo && rng() < 0.7) replyTo = opts.threadTo;
        else {
          const recent = channelMessages(channelId, 6).filter((m) => Date.now() - m.createdAt < 3 * 3600_000);
          replyTo = recent.length ? weightedPick(recent.map((m, i) => [m, 6 - i] as [Message, number]), rng) : undefined;
        }
      }
      const exclude = replyTo ? [replyTo.authorId] : [];
      // Relationship graph: people reply to the people they like replying to.
      let author: User | undefined;
      if (replyTo) {
        const fans = NPC_PROFILES.filter((p) => p.relationships.includes(replyTo!.authorId)).map((p) => p.userId);
        const candidate = fans.length && rng() < 0.55 ? st.users[pick(fans, rng)] : undefined;
        if (candidate && candidate.presence !== "offline" && candidate.id !== replyTo.authorId) author = candidate;
      }
      author ??= pickAuthor(channelId, exclude);
      if (!author) return null;
      const replyAuthor = replyTo ? st.users[replyTo.authorId] : undefined;
      const category: Category = replyTo
        ? replyTo.authorId === st.viewerId
          ? ownerReplyCategory(eff, rng)
          : rng() < 0.45
            ? replyCategory(eff, replyTo.simTag, rng)
            : ELIAS_TAGS.has(replyTo.simTag ?? "") && rng() < 0.7
              ? eliasCategory(eff.glaze, rng)
              : replyTo.simTag === "prompt" && parsed.topics.length && rng() < 0.6
                ? "prompt"
                : freshCategory(st.sim, eff, parsed.topics.length > 0, rng)
        : freshCategory(st.sim, eff, parsed.topics.length > 0, rng);
      const c = composeAny(category, author, channelId, parsed, replyAuthor?.displayName);
      return c ? { c, author, replyToId: replyTo?.id } : null;
    };

    /** Post with a typing indicator first (400–2500ms, faster on chaos). */
    const postWithTyping = (channelId: string, d: NonNullable<ReturnType<typeof draft>>, onPosted?: (m: Message) => void) => {
      const a = S().sim.activity;
      const typingMs = Math.min(2500, Math.max(400, 350 + d.c.en.length * 28)) / Math.sqrt(Math.max(0.5, a));
      S().setTyping(channelId, d.author.id, true);
      later(typingMs, () => {
        if (S().sim.paused || rng() < 0.04) {
          S().setTyping(channelId, d.author.id, false); // typed, thought better of it
          return;
        }
        const msg = toMessage(d.c, d.author, channelId, d.replyToId);
        S().npcPost(msg, d.c.category);
        onPosted?.(msg);
      });
    };

    /* ── background micro-acts ── */
    const react = () => {
      const channelId = pickChannel();
      const recent = channelMessages(channelId, 8);
      if (!recent.length) return;
      const m = pick(recent, rng);
      const tag = m.simTag && REACTIONS[m.simTag] ? m.simTag : "default";
      const existing = m.reactions?.filter((r) => r.count > 0) ?? [];
      const emoji = existing.length && rng() < 0.55 ? pick(existing, rng).emoji : pick(REACTIONS[tag]!, rng);
      S().npcReact(m.id, emoji);
    };

    const voiceFlip = () => {
      const users = npcIds();
      const inVoice = users.filter((u) => u.voiceChannelId && !u.selfDeaf);
      if (inVoice.length && rng() < 0.75) {
        const u = pick(inVoice, rng);
        S().patchUser(u.id, { speaking: !u.speaking && !u.selfMute });
        return;
      }
      if (rng() < 0.5 && inVoice.length > 2) {
        const u = pick(inVoice, rng);
        S().patchUser(u.id, { voiceChannelId: undefined, speaking: false });
      } else {
        const free = users.filter((u) => !u.voiceChannelId && u.presence === "online");
        if (free.length) S().patchUser(pick(free, rng).id, { voiceChannelId: pick(VOICE.slice(0, 2), rng), speaking: false });
      }
    };

    const presenceFlip = () => {
      const u = pick(npcIds(), rng);
      if (u.voiceChannelId) return;
      const next = u.presence === "online" ? (rng() < 0.7 ? "idle" : "offline") : "online";
      S().patchUser(u.id, { presence: next });
    };

    /* ── the clock: quiet gaps, then 3–6 message flurries ── */
    let flurryLeft = 0;
    let flurryChannel = "c_general";
    let thread: Message | null = null;

    const step = () => {
      const st = S();
      if (!st.ready) return later(400, step);
      const a = st.sim.activity;
      if (st.sim.paused) return later(800, step);
      if (rng() < 0.2) react();
      if (rng() < 0.12) voiceFlip();
      if (rng() < 0.025) presenceFlip();

      if (flurryLeft <= 0) {
        flurryLeft = 3 + Math.floor(rng() * 4) + Math.floor(Math.max(0, a - 1));
        flurryChannel = pickChannel();
        thread = null;
      }
      const d = draft(flurryChannel, { threadTo: thread, replyChance: thread ? 0.55 : 0.45 });
      if (d) postWithTyping(flurryChannel, d, (m) => (thread = m));
      flurryLeft--;
      // Chaos also opens a second conversation in parallel.
      if (a > 1.6 && rng() < (a - 1.6) / 2) {
        const other = pickChannel();
        const d2 = other !== flurryChannel ? draft(other, { replyChance: 0.45 }) : null;
        if (d2) postWithTyping(other, d2);
      }
      const gap = flurryLeft > 0 ? rand(rng, 1500, 4800) : rand(rng, 5000, 20000);
      later(gap / a, step);
    };

    /* ── cold open: the room is already talking where you look ── */
    const coldOpen = () => {
      const current = S().channelByGuild[S().guildId] ?? "c_general";
      flurryChannel = CHANNEL_WEIGHTS[current] ? current : "c_general";
      flurryLeft = 4 + Math.floor(rng() * 2);
      thread = null;
      later(900, step);
    };

    /* ── Backstage "Start a burst": a flurry right where you're looking ── */
    const unsubscribeBurst = useLounge.subscribe((state, prev) => {
      if (state.burstSeq === prev.burstSeq) return;
      const current = state.channelByGuild[state.guildId] ?? "c_general";
      const channelId = CHANNEL_WEIGHTS[current] ? current : "c_general";
      let threadMsg: Message | null = null;
      for (let i = 0; i < 6; i++) {
        later(i * rand(rng, 500, 1100), () => {
          const d = draft(channelId, { threadTo: threadMsg, replyChance: 0.6 });
          if (d) postWithTyping(channelId, d, (m) => (threadMsg = m));
        });
      }
    });

    /* ── a human speaks → people answer (owner: the usual crowd; guests: a welcome) ── */
    const handled = new Set<string>();
    const startedAt = Date.now();
    const unsubscribe = useLounge.subscribe((state, prev) => {
      if (state.messages === prev.messages || state.sim.paused) return;
      // Own messages are answered once, on the optimistic copy (m_local_); others' by server id.
      const last = state.messages
        .slice(-12)
        .reverse()
        .find(
          (m) =>
            m.isHuman &&
            !m.failed &&
            m.createdAt >= startedAt - 5000 &&
            !handled.has(m.id) &&
            (m.authorId === state.viewerId ? m.id.startsWith("m_local_") : true),
        );
      if (!last) return;
      handled.add(last.id);
      const a = state.sim.activity;
      if (state.users[last.authorId]?.roleId !== "owner") {
        const guest = state.users[last.authorId];
        later(rand(rng, 1500, 3500) / Math.sqrt(a), () => {
          const st = S();
          const parsed = parsePrompt(st.sim.prompt);
          const author = pickAuthor(last.channelId);
          if (!author) return;
          const c = composeAny(last.channelId === "c_intros" || rng() < 0.4 ? "greet" : "agree", author, last.channelId, parsed, guest?.displayName);
          if (c) postWithTyping(last.channelId, { c, author, replyToId: last.id });
        });
        return;
      }
      const replies = 1 + (rng() < 0.6 ? 1 : 0) + (rng() < 0.25 * a ? 1 : 0);
      let delay = rand(rng, 900, 2600) / Math.sqrt(a);
      const used: string[] = [];
      for (let i = 0; i < replies; i++) {
        later(delay, () => {
          const st = S();
          const parsed = parsePrompt(st.sim.prompt);
          const eff = effective(st.sim, parsed);
          const author = pickAuthor(last.channelId, used);
          if (!author) return;
          used.push(author.id);
          // First answers go to the owner; later ones sometimes riff on each other.
          const c = composeAny(i === 0 || rng() < 0.6 ? ownerReplyCategory(eff, rng) : replyCategory(eff, undefined, rng), author, last.channelId, parsed, "elias");
          if (c) postWithTyping(last.channelId, { c, author, replyToId: rng() < 0.75 ? last.id : undefined });
        });
        delay += rand(rng, 1600, 4200) / Math.sqrt(a);
      }
    });

    /* ── tab hidden → fill in history when you come back ── */
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const away = Date.now() - hiddenAt;
      if (!hiddenAt || away < 45_000 || S().sim.paused) return;
      const a = S().sim.activity;
      const n = Math.min(30, Math.floor((away / 6000) * a));
      const batch: Message[] = [];
      for (let i = 0; i < n; i++) {
        const channelId = pickChannel();
        const d = draft(channelId, { replyChance: 0.45 });
        if (!d) continue;
        const at = hiddenAt + Math.round(((i + 1) / (n + 1)) * away);
        const msg = toMessage(d.c, d.author, channelId, d.replyToId, at);
        S().npcPost(msg, d.c.category);
        batch.push(msg);
      }
      hiddenAt = 0;
      if (batch.length) useLounge.setState((s) => ({ messages: [...s.messages].sort((x, y) => x.createdAt - y.createdAt) }));
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Seeded "typing" was a static fake; the live sim owns typing from here on.
    useLounge.setState({ typing: {} });
    coldOpen();

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      unsubscribe();
      unsubscribeBurst();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
