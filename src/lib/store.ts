"use client";

import { create } from "zustand";
import { DEFAULT_CHANNEL_ID, DEFAULT_GUILD_ID, GUILDS } from "@/data/guilds";
import { SEED_READ_STATE, SEED_TYPING } from "@/data/messages";
import { OWNER_ID } from "@/data/npcs";
import { buildSeed } from "@/data/seed";
import type { ChannelReadState, Message, User } from "./types";

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

  /** Esc handler: closes the top-most overlay. Returns true if something closed. */
  closeOverlays: () => {
    const s = get();
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
