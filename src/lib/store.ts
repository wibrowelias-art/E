"use client";

import { create } from "zustand";
import { DEFAULT_CHANNEL_ID, DEFAULT_GUILD_ID, GUILDS } from "@/data/guilds";
import { SEED_READ_STATE, SEED_TYPING } from "@/data/messages";
import { OWNER_ID } from "@/data/npcs";
import { buildSeed } from "@/data/seed";
import { api, ApiFailure } from "./api";
import { LANG_STORAGE_KEY, STRINGS, type Lang } from "./i18n";
import { safetyCheck, SAFETY_MESSAGE } from "./safety";
import { clampSettings, DEFAULT_SIM, PRESETS, SIM_STORAGE_KEY } from "./sim/settings";
import type { ChannelReadState, Message, RoleId, SimSettings, User } from "./types";

export interface SimLogEntry {
  at: number;
  authorId: string;
  channelId: string;
  category: string;
  text: string;
  textDe: string;
}

const MAX_MESSAGES = 3000;
const HISTORY_PAGE = 120;
/** Tourists (guests) may post here; everything else is read + react. */
export const GUEST_POST_CHANNELS = new Set(["c_intros"]);

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — settings just won't survive a reload */
  }
}

let simSettingsTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export type MobilePane = "channels" | "chat";

interface BootResponse {
  persistence: boolean;
  persistenceError?: string | null;
  viewer: User;
  role: RoleId;
  users?: User[];
  messages?: Message[];
  sim?: SimSettings | null;
  rev?: number;
  serverNow?: number;
  typing?: TypingEntry[];
}

export interface TypingEntry {
  channelId: string;
  userId: string;
}

function typingMap(list: TypingEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of list) (out[t.channelId] ??= []).includes(t.userId) || out[t.channelId]!.push(t.userId);
  return out;
}

interface LoungeState {
  ready: boolean;
  now: number;
  viewerId: string;
  role: RoleId;
  /** true = messages live in the database (Phase 2); false = local in-browser mode */
  persistence: boolean;
  persistenceNote: string | null;
  rev: number;
  /** Server time of the last poll (second cursor for scheduled floor messages). */
  serverNow: number;
  history: Record<string, { hasMore: boolean; loading: boolean }>;
  toast: { text: string; kind: "error" | "info" } | null;
  users: Record<string, User>;
  messages: Message[];
  readState: Record<string, ChannelReadState>;
  typing: Record<string, string[]>;
  guildId: string;
  channelByGuild: Record<string, string>;
  mobilePane: MobilePane;
  membersOpen: boolean;
  editingId: string | null;
  replyingToId: string | null;
  profileUserId: string | null;
  profileAnchor: { x: number; y: number } | null;
  collapsed: Record<string, boolean>;
  /** ?fixture=ref — reference-parity channel list for the comparison loop */
  fixture: boolean;
  lang: Lang;
  sim: SimSettings;
  simLog: SimLogEntry[];
  backstageOpen: boolean;
  settingsMenu: { x: number; y: number; mobile: boolean } | null;
  /** Incremented by Backstage "Start a burst" — the engine listens. */
  burstSeq: number;

  boot: (opts: { now: number; forceLocal?: boolean }) => Promise<void>;
  hydrateLocal: (now: number, viewer?: User) => void;
  mergeServer: (messages: Message[], users: User[], rev: number, serverNow?: number, typing?: TypingEntry[]) => void;
  loadOlder: (channelId: string) => Promise<void>;
  selectGuild: (guildId: string) => void;
  selectChannel: (channelId: string, opts?: { openChat?: boolean }) => void;
  setMobilePane: (p: MobilePane) => void;
  toggleMembers: (open?: boolean) => void;
  toggleCategory: (categoryId: string) => void;
  canPost: (channelId: string) => boolean;
  send: (channelId: string, content: string) => void;
  retrySend: (tempId: string) => void;
  discardFailed: (tempId: string) => void;
  startEdit: (messageId: string | null) => void;
  saveEdit: (messageId: string, content: string) => void;
  setReplyingTo: (messageId: string | null) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  openProfile: (userId: string | null, anchor?: { x: number; y: number }) => void;
  showToast: (text: string, kind?: "error" | "info") => void;
  closeOverlays: () => boolean;
  loadPrefs: () => void;
  setLang: (lang: Lang) => void;
  setSim: (patch: Partial<SimSettings>) => void;
  applyPreset: (id: string) => void;
  openBackstage: (open: boolean) => void;
  openSettingsMenu: (at: { x: number; y: number; mobile: boolean } | null) => void;
  requestBurst: () => void;
  resetSim: () => void;
  logout: () => Promise<void>;
  /** Simulator: post as an NPC (never as a human). */
  npcPost: (msg: Message, category: string) => void;
  setTyping: (channelId: string, userId: string, on: boolean) => void;
  npcReact: (messageId: string, emoji: string) => void;
  patchUser: (userId: string, patch: Partial<User>) => void;
}

let localSeq = 0;

function insertSorted(list: Message[], incoming: Message[]): Message[] {
  if (!incoming.length) return list;
  const out = [...list, ...incoming];
  const last = list[list.length - 1];
  if (last && incoming.some((m) => m.createdAt < last.createdAt)) out.sort((a, b) => a.createdAt - b.createdAt);
  return out.length > MAX_MESSAGES ? out.slice(-MAX_MESSAGES + 300) : out;
}

export const useLounge = create<LoungeState>((set, get) => ({
  ready: false,
  now: 0,
  viewerId: OWNER_ID,
  role: "owner",
  persistence: false,
  persistenceNote: null,
  rev: 0,
  serverNow: 0,
  history: {},
  toast: null,
  users: {},
  messages: [],
  readState: { ...SEED_READ_STATE },
  typing: { ...SEED_TYPING },
  guildId: DEFAULT_GUILD_ID,
  channelByGuild: Object.fromEntries(
    GUILDS.map((g) => [g.id, g.id === DEFAULT_GUILD_ID ? DEFAULT_CHANNEL_ID : g.channels.find((c) => c.kind === "text")!.id]),
  ),
  mobilePane: "chat",
  membersOpen: true,
  editingId: null,
  replyingToId: null,
  profileUserId: null,
  profileAnchor: null,
  collapsed: {},
  fixture: false,
  lang: "en",
  sim: { ...DEFAULT_SIM },
  simLog: [],
  backstageOpen: false,
  settingsMenu: null,
  burstSeq: 0,

  boot: async ({ now, forceLocal }) => {
    if (get().ready) return;
    let res: BootResponse;
    try {
      res = await api<BootResponse>("/api/bootstrap");
    } catch (e) {
      // Network trouble: keep the floor usable locally.
      get().hydrateLocal(now);
      get().showToast(e instanceof ApiFailure ? e.message : "Couldn't reach the server — local mode.");
      return;
    }
    set({ viewerId: res.viewer.id, role: res.role });
    if (!res.persistence || forceLocal) {
      set({
        persistence: false,
        persistenceNote: forceLocal ? "Local mode (forced by ?local=1)." : (res.persistenceError ?? "No database configured."),
      });
      get().hydrateLocal(now, res.viewer);
      return;
    }
    const messages = res.messages ?? [];
    const perChannel = new Map<string, number>();
    for (const m of messages) perChannel.set(m.channelId, (perChannel.get(m.channelId) ?? 0) + 1);
    const history: LoungeState["history"] = {};
    for (const g of GUILDS) for (const c of g.channels) history[c.id] = { hasMore: (perChannel.get(c.id) ?? 0) >= HISTORY_PAGE, loading: false };
    const users = Object.fromEntries((res.users ?? []).map((u) => [u.id, u]));
    users[res.viewer.id] ??= res.viewer;
    set({
      ready: true,
      now: Date.now(),
      persistence: true,
      persistenceNote: null,
      users,
      messages,
      history,
      rev: res.rev ?? 0,
      serverNow: res.serverNow ?? Date.now(),
      // Seeded read state was a static fake; real unread comes from the poll. Typing comes from the server floor.
      readState: {},
      typing: typingMap(res.typing ?? []),
      ...(res.sim ? { sim: clampSettings({ ...res.sim, paused: res.sim.paused }) } : {}),
    });
  },

  hydrateLocal: (now, viewer) => {
    if (get().ready) return;
    const seed = buildSeed(now);
    const users = Object.fromEntries(seed.users.map((u) => [u.id, u]));
    if (viewer) users[viewer.id] = viewer;
    set({ ready: true, now, users, messages: seed.messages });
  },

  mergeServer: (incoming, users, rev, serverNow, typing) =>
    set((s) => {
      const index = new Map(s.messages.map((m, i) => [m.id, i]));
      const messages = [...s.messages];
      const fresh: Message[] = [];
      for (const m of incoming) {
        const i = index.get(m.id);
        if (i !== undefined) messages[i] = { ...m, pending: undefined, failed: undefined };
        else fresh.push(m);
      }
      const current = s.channelByGuild[s.guildId];
      const viewer = s.users[s.viewerId];
      const readState = { ...s.readState };
      for (const m of fresh) {
        if (m.authorId === s.viewerId) continue;
        const visible = m.channelId === current && !document.hidden;
        if (visible) continue;
        const prev = readState[m.channelId] ?? { unread: false, mentions: 0 };
        const text = m.i18n?.en ?? m.content;
        const mentioned = viewer ? new RegExp(`@${viewer.displayName}\\b`, "i").test(text) : false;
        readState[m.channelId] = { unread: true, mentions: prev.mentions + (mentioned ? 1 : 0) };
      }
      const nextUsers = users.length ? { ...s.users, ...Object.fromEntries(users.map((u) => [u.id, u])) } : s.users;
      // Backstage live feed: what the server floor just published.
      const floorLines = fresh
        .filter((m) => m.simTag && m.simTag !== "system")
        .map((m) => ({ at: m.createdAt, authorId: m.authorId, channelId: m.channelId, category: m.simTag!, text: m.i18n?.en ?? m.content, textDe: m.i18n?.de ?? m.content }))
        .reverse();
      return {
        messages: insertSorted(messages, fresh),
        users: nextUsers,
        rev: Math.max(s.rev, rev),
        serverNow: serverNow ?? s.serverNow,
        readState,
        now: Date.now(),
        ...(typing ? { typing: typingMap(typing) } : {}),
        ...(floorLines.length ? { simLog: [...floorLines, ...s.simLog].slice(0, 12) } : {}),
      };
    }),

  loadOlder: async (channelId) => {
    const s = get();
    const h = s.history[channelId];
    if (!s.persistence || !h?.hasMore || h.loading) return;
    const oldest = s.messages.find((m) => m.channelId === channelId);
    set({ history: { ...s.history, [channelId]: { ...h, loading: true } } });
    try {
      const res = await api<{ messages: Message[]; hasMore: boolean }>(
        `/api/messages/history?channel=${encodeURIComponent(channelId)}&before=${oldest?.createdAt ?? Date.now()}&limit=80`,
      );
      set((st) => {
        const known = new Set(st.messages.map((m) => m.id));
        const older = res.messages.filter((m) => !known.has(m.id));
        return {
          messages: [...older, ...st.messages].sort((a, b) => a.createdAt - b.createdAt),
          history: { ...st.history, [channelId]: { hasMore: res.hasMore, loading: false } },
        };
      });
    } catch {
      set((st) => ({ history: { ...st.history, [channelId]: { ...h, loading: false } } }));
    }
  },

  selectGuild: (guildId) => set({ guildId }),

  selectChannel: (channelId, opts) =>
    set((s) => ({
      channelByGuild: { ...s.channelByGuild, [s.guildId]: channelId },
      readState: { ...s.readState, [channelId]: { unread: false, mentions: 0 } },
      mobilePane: opts?.openChat === false ? s.mobilePane : "chat",
      editingId: null,
      replyingToId: null,
    })),

  setMobilePane: (mobilePane) => set({ mobilePane }),
  toggleMembers: (open) => set((s) => ({ membersOpen: open ?? !s.membersOpen })),
  toggleCategory: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),

  canPost: (channelId) => {
    const s = get();
    if (s.role === "owner") return true;
    const ch = GUILDS.flatMap((g) => g.channels).find((c) => c.id === channelId);
    if (!ch || ch.staffOnly || ch.id === "c_welcome") return false;
    return s.role !== "tourist" || GUEST_POST_CHANNELS.has(channelId);
  },

  send: (channelId, content) => {
    const text = content.trim();
    if (!text) return;
    const s = get();
    if (!s.canPost(channelId)) return s.showToast("Guests can post in #introductions — everything else is read-only for you.");
    const safe = safetyCheck(text);
    if (!safe.ok) return s.showToast(SAFETY_MESSAGE[safe.reason]);
    const temp: Message = {
      id: `m_local_${Date.now()}_${localSeq++}`,
      channelId,
      authorId: s.viewerId,
      content: text,
      createdAt: Date.now(),
      replyToId: s.replyingToId ?? undefined,
      isHuman: true,
      pending: s.persistence || undefined,
    };
    set({ messages: [...s.messages, temp], replyingToId: null, now: Date.now() });
    if (!s.persistence) return;
    void api<{ message: Message }>("/api/messages", { body: { channelId, content: text, replyToId: temp.replyToId } })
      .then(({ message }) =>
        set((st) => ({
          // The poll may already have delivered it; keep one copy.
          messages: st.messages.some((m) => m.id === message.id)
            ? st.messages.filter((m) => m.id !== temp.id)
            : st.messages.map((m) => (m.id === temp.id ? message : m)),
        })),
      )
      .catch((e: unknown) => {
        const reason = e instanceof Error ? e.message : "Failed to send.";
        set((st) => ({ messages: st.messages.map((m) => (m.id === temp.id ? { ...m, pending: undefined, failed: reason } : m)) }));
        get().showToast(reason);
      });
  },

  retrySend: (tempId) => {
    const m = get().messages.find((x) => x.id === tempId);
    if (!m) return;
    set((st) => ({ messages: st.messages.filter((x) => x.id !== tempId), replyingToId: m.replyToId ?? null }));
    get().send(m.channelId, m.content);
  },

  discardFailed: (tempId) => set((st) => ({ messages: st.messages.filter((x) => x.id !== tempId) })),

  startEdit: (editingId) => set({ editingId }),

  saveEdit: (id, content) => {
    const s = get();
    const before = s.messages.find((m) => m.id === id);
    const text = content.trim();
    set({ editingId: null });
    if (!before || !text || text === before.content) return;
    const safe = safetyCheck(text);
    if (!safe.ok) return s.showToast(SAFETY_MESSAGE[safe.reason]);
    set((st) => ({ messages: st.messages.map((m) => (m.id === id ? { ...m, content: text, editedAt: Date.now() } : m)) }));
    if (!s.persistence || id.startsWith("m_local_")) return;
    void api<{ message: Message }>(`/api/messages/${encodeURIComponent(id)}`, { method: "PATCH", body: { content: text } })
      .then(({ message }) => set((st) => ({ messages: st.messages.map((m) => (m.id === id ? message : m)) })))
      .catch((e: unknown) => {
        set((st) => ({ messages: st.messages.map((m) => (m.id === id ? before : m)) }));
        get().showToast(e instanceof Error ? e.message : "Couldn't save the edit.");
      });
  },

  setReplyingTo: (replyingToId) => set({ replyingToId }),

  toggleReaction: (messageId, emoji) => {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions ?? [])];
        const i = reactions.findIndex((r) => r.emoji === emoji);
        if (i === -1) reactions.push({ emoji, count: 1, me: true });
        else {
          const r = reactions[i]!;
          const next = { ...r, me: !r.me, count: r.count + (r.me ? -1 : 1) };
          if (next.count <= 0) reactions.splice(i, 1);
          else reactions[i] = next;
        }
        return { ...m, reactions };
      }),
    }));
    if (!get().persistence || messageId.startsWith("m_local_")) return;
    void api<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}/reactions`, { body: { emoji } })
      .then(({ message }) => set((st) => ({ messages: st.messages.map((m) => (m.id === messageId ? message : m)) })))
      .catch((e: unknown) => get().showToast(e instanceof Error ? e.message : "Reaction failed."));
  },

  openProfile: (profileUserId, anchor) => set({ profileUserId, profileAnchor: anchor ?? null }),

  showToast: (text, kind = "error") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { text, kind } });
    toastTimer = setTimeout(() => set({ toast: null }), 4200);
  },

  loadPrefs: () => {
    try {
      const lang = JSON.parse(window.localStorage.getItem(LANG_STORAGE_KEY) ?? "null");
      const sim = JSON.parse(window.localStorage.getItem(SIM_STORAGE_KEY) ?? "null");
      set({
        lang: lang === "de" ? "de" : "en",
        sim: sim ? clampSettings(sim) : { ...DEFAULT_SIM },
      });
    } catch {
      /* ignore corrupt prefs */
    }
  },

  setLang: (lang) => {
    persist(LANG_STORAGE_KEY, lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    set({ lang });
  },

  setSim: (patch) => {
    const sim = clampSettings({ ...get().sim, ...patch });
    persist(SIM_STORAGE_KEY, sim);
    set({ sim });
    // Owner + database → Backstage settings are saved server-side (debounced).
    if (get().persistence && get().role === "owner") {
      if (simSettingsTimer) clearTimeout(simSettingsTimer);
      simSettingsTimer = setTimeout(() => {
        void api("/api/sim/settings", { method: "PUT", body: get().sim }).catch(() => get().showToast("Couldn't save Backstage settings."));
      }, 400);
    }
  },

  applyPreset: (id) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) get().setSim(p.values);
  },

  openBackstage: (backstageOpen) => set({ backstageOpen: backstageOpen && get().role === "owner", settingsMenu: null }),
  openSettingsMenu: (settingsMenu) => set({ settingsMenu }),
  requestBurst: () => {
    const s = get();
    if (!s.persistence) return set({ burstSeq: s.burstSeq + 1 });
    void api("/api/sim/burst", { body: { channelId: s.channelByGuild[s.guildId] } }).catch((e: unknown) =>
      get().showToast(e instanceof Error ? e.message : "Burst failed."),
    );
  },
  resetSim: () => get().setSim({ ...DEFAULT_SIM }),

  logout: async () => {
    await api("/api/auth/logout", { body: {} }).catch(() => null);
    window.location.href = "/login";
  },

  npcPost: (msg, category) => {
    set((s) => {
      const current = s.channelByGuild[s.guildId];
      const visible = msg.channelId === current && (typeof document === "undefined" || !document.hidden);
      const viewer = s.users[s.viewerId];
      const text = msg.i18n?.en ?? msg.content;
      const mentionsViewer = viewer ? new RegExp(`@${viewer.displayName}\\b`, "i").test(text) : false;
      const prev = s.readState[msg.channelId] ?? { unread: false, mentions: 0 };
      const typing = s.typing[msg.channelId]?.filter((id) => id !== msg.authorId) ?? [];
      return {
        messages: insertSorted(s.messages, [msg]),
        now: Date.now(),
        typing: { ...s.typing, [msg.channelId]: typing },
        readState: visible
          ? s.readState
          : { ...s.readState, [msg.channelId]: { unread: true, mentions: prev.mentions + (mentionsViewer ? 1 : 0) } },
        simLog: [
          { at: msg.createdAt, authorId: msg.authorId, channelId: msg.channelId, category, text, textDe: msg.i18n?.de ?? msg.content },
          ...s.simLog,
        ].slice(0, 12),
      };
    });
  },

  setTyping: (channelId, userId, on) =>
    set((s) => {
      const list = s.typing[channelId] ?? [];
      const next = on ? (list.includes(userId) ? list : [...list, userId]) : list.filter((id) => id !== userId);
      return { typing: { ...s.typing, [channelId]: next } };
    }),

  npcReact: (messageId, emoji) => {
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions ?? [])];
        const i = reactions.findIndex((r) => r.emoji === emoji);
        if (i === -1) reactions.push({ emoji, count: 1, me: false });
        else reactions[i] = { ...reactions[i]!, count: reactions[i]!.count + 1 };
        return { ...m, reactions };
      }),
    }));
  },

  patchUser: (userId, patch) => {
    set((s) => (s.users[userId] ? { users: { ...s.users, [userId]: { ...s.users[userId]!, ...patch } } } : {}));
  },

  /** Esc handler: closes the top-most overlay. Returns true if something closed. */
  closeOverlays: () => {
    const s = get();
    if (s.settingsMenu) return set({ settingsMenu: null }), true;
    if (s.backstageOpen) return set({ backstageOpen: false }), true;
    if (s.profileUserId) return set({ profileUserId: null }), true;
    if (s.editingId) return set({ editingId: null }), true;
    if (s.replyingToId) return set({ replyingToId: null }), true;
    return false;
  },
}));

export function useCurrentGuild() {
  const guildId = useLounge((s) => s.guildId);
  return GUILDS.find((g) => g.id === guildId)!;
}

export function useCurrentChannel() {
  const guild = useCurrentGuild();
  const channelId = useLounge((s) => s.channelByGuild[s.guildId]);
  return guild.channels.find((c) => c.id === channelId) ?? guild.channels[0]!;
}

export function useT() {
  const lang = useLounge((s) => s.lang);
  return STRINGS[lang];
}

/** Text of a message in the current UI language. */
export function messageText(m: Message, lang: Lang): string {
  return m.i18n ? m.i18n[lang] : m.content;
}
