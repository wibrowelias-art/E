"use client";

import { create } from "zustand";
import { DEFAULT_CHANNEL_ID, DEFAULT_GUILD_ID, GUILDS } from "@/data/guilds";
import { SEED_READ_STATE, SEED_TYPING } from "@/data/messages";
import { OWNER_ID } from "@/data/npcs";
import { buildSeed } from "@/data/seed";
import { LANG_STORAGE_KEY, STRINGS, type Lang } from "./i18n";
import { clampSettings, DEFAULT_SIM, PRESETS, SIM_STORAGE_KEY } from "./sim/settings";
import type { ChannelReadState, Message, SimSettings, User } from "./types";

export interface SimLogEntry {
  at: number;
  authorId: string;
  channelId: string;
  category: string;
  text: string;
  textDe: string;
}

const MAX_MESSAGES = 2500;

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — settings just won't survive a reload */
  }
}

export type MobilePane = "channels" | "chat";

interface LoungeState {
  ready: boolean;
  now: number;
  viewerId: string;
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

  hydrate: (now: number) => void;
  selectGuild: (guildId: string) => void;
  selectChannel: (channelId: string, opts?: { openChat?: boolean }) => void;
  setMobilePane: (p: MobilePane) => void;
  toggleMembers: (open?: boolean) => void;
  toggleCategory: (categoryId: string) => void;
  send: (channelId: string, content: string) => void;
  startEdit: (messageId: string | null) => void;
  saveEdit: (messageId: string, content: string) => void;
  setReplyingTo: (messageId: string | null) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  openProfile: (userId: string | null, anchor?: { x: number; y: number }) => void;
  closeOverlays: () => boolean;
  loadPrefs: () => void;
  setLang: (lang: Lang) => void;
  setSim: (patch: Partial<SimSettings>) => void;
  applyPreset: (id: string) => void;
  openBackstage: (open: boolean) => void;
  openSettingsMenu: (at: { x: number; y: number; mobile: boolean } | null) => void;
  requestBurst: () => void;
  resetSim: () => void;
  /** Simulator: post as an NPC (never as the owner). */
  npcPost: (msg: Message, category: string) => void;
  setTyping: (channelId: string, userId: string, on: boolean) => void;
  npcReact: (messageId: string, emoji: string) => void;
  patchUser: (userId: string, patch: Partial<User>) => void;
}

let localSeq = 0;

export const useLounge = create<LoungeState>((set, get) => ({
  ready: false,
  now: 0,
  viewerId: OWNER_ID,
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

  hydrate: (now) => {
    if (get().ready) return;
    const seed = buildSeed(now);
    set({
      ready: true,
      now,
      users: Object.fromEntries(seed.users.map((u) => [u.id, u])),
      messages: seed.messages,
    });
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

  send: (channelId, content) => {
    const text = content.trim();
    if (!text) return;
    const s = get();
    const msg: Message = {
      id: `m_local_${Date.now()}_${localSeq++}`,
      channelId,
      authorId: s.viewerId,
      content: text,
      createdAt: Date.now(),
      replyToId: s.replyingToId ?? undefined,
      isHuman: true,
    };
    set({ messages: [...s.messages, msg], replyingToId: null, now: Date.now() });
  },

  startEdit: (editingId) => set({ editingId }),

  saveEdit: (id, content) =>
    set((s) => ({
      editingId: null,
      messages: s.messages.map((m) =>
        m.id === id && content.trim() && content.trim() !== m.content
          ? { ...m, content: content.trim(), editedAt: Date.now() }
          : m,
      ),
    })),

  setReplyingTo: (replyingToId) => set({ replyingToId }),

  toggleReaction: (messageId, emoji) =>
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
    })),

  openProfile: (profileUserId, anchor) => set({ profileUserId, profileAnchor: anchor ?? null }),

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
  },

  applyPreset: (id) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) get().setSim(p.values);
  },

  openBackstage: (backstageOpen) => set({ backstageOpen, settingsMenu: null }),
  openSettingsMenu: (settingsMenu) => set({ settingsMenu }),
  requestBurst: () => set((s) => ({ burstSeq: s.burstSeq + 1 })),
  resetSim: () => get().setSim({ ...DEFAULT_SIM }),

  npcPost: (msg, category) =>
    set((s) => {
      const current = s.channelByGuild[s.guildId];
      const visible = msg.channelId === current && (typeof document === "undefined" || !document.hidden);
      const mentionsViewer = /@Elias\b/.test(msg.i18n?.en ?? msg.content);
      const prev = s.readState[msg.channelId] ?? { unread: false, mentions: 0 };
      const typing = s.typing[msg.channelId]?.filter((id) => id !== msg.authorId) ?? [];
      const messages = s.messages.length >= MAX_MESSAGES ? [...s.messages.slice(-MAX_MESSAGES + 200), msg] : [...s.messages, msg];
      return {
        messages,
        now: Date.now(),
        typing: { ...s.typing, [msg.channelId]: typing },
        readState: visible
          ? s.readState
          : { ...s.readState, [msg.channelId]: { unread: true, mentions: prev.mentions + (mentionsViewer ? 1 : 0) } },
        simLog: [
          { at: msg.createdAt, authorId: msg.authorId, channelId: msg.channelId, category, text: msg.i18n?.en ?? msg.content, textDe: msg.i18n?.de ?? msg.content },
          ...s.simLog,
        ].slice(0, 12),
      };
    }),

  setTyping: (channelId, userId, on) =>
    set((s) => {
      const list = s.typing[channelId] ?? [];
      const next = on ? (list.includes(userId) ? list : [...list, userId]) : list.filter((id) => id !== userId);
      return { typing: { ...s.typing, [channelId]: next } };
    }),

  npcReact: (messageId, emoji) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions ?? [])];
        const i = reactions.findIndex((r) => r.emoji === emoji);
        if (i === -1) reactions.push({ emoji, count: 1, me: false });
        else reactions[i] = { ...reactions[i]!, count: reactions[i]!.count + 1 };
        return { ...m, reactions };
      }),
    })),

  patchUser: (userId, patch) =>
    set((s) => (s.users[userId] ? { users: { ...s.users, [userId]: { ...s.users[userId]!, ...patch } } } : {})),

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
