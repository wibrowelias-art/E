"use client";

import { create } from "zustand";
import { GUILD_SLUG_BY_ID, GUILDS } from "@/data/guilds";
import { plainPreview } from "./markup";
import { messageText, useLounge } from "./store";
import type { Message } from "./types";

/* ───────── Sounds: synthesized on the fly (Web Audio), short and soft. No audio files. ───────── */

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Browsers only allow audio after a user gesture: unlock on the first tap/click/key. */
export function primeAudio() {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine", glideTo?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(filter).connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export type SoundName = "mention" | "reply" | "sent" | "message";

export function playSound(name: SoundName) {
  if (!useFeel.getState().sounds) return;
  const c = audio();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.01;
  switch (name) {
    case "mention": // two-note "lounge bell": a soft rising fifth with a quiet shimmer
      tone(c, t, 659.25, 0.32, 0.07);
      tone(c, t + 0.09, 987.77, 0.42, 0.06);
      tone(c, t + 0.09, 1975.5, 0.25, 0.012);
      break;
    case "reply": // one round glass tap
      tone(c, t, 880, 0.28, 0.055);
      tone(c, t, 1760, 0.14, 0.01);
      break;
    case "message": // muted wooden pop
      tone(c, t, 520, 0.11, 0.04, "triangle", 360);
      break;
    case "sent": // tiny airy tick
      tone(c, t, 1300, 0.06, 0.018, "sine", 1700);
      break;
  }
}

/* ───────── Preferences ───────── */

interface FeelState {
  sounds: boolean;
  notify: boolean;
  setSounds: (on: boolean) => void;
  setNotify: (on: boolean) => Promise<void>;
  load: () => void;
}

const SOUNDS_KEY = "lounge.sounds";
const NOTIFY_KEY = "lounge.notify";

export const useFeel = create<FeelState>((set) => ({
  sounds: true,
  notify: false,
  load: () => {
    try {
      const sounds = localStorage.getItem(SOUNDS_KEY);
      const notify = localStorage.getItem(NOTIFY_KEY) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
      set({ sounds: sounds === null ? true : sounds === "1", notify });
    } catch {
      /* ignore */
    }
  },
  setSounds: (sounds) => {
    try {
      localStorage.setItem(SOUNDS_KEY, sounds ? "1" : "0");
    } catch {}
    set({ sounds });
    if (sounds) playSound("reply");
  },
  setNotify: async (on) => {
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const res = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
      if (res !== "granted") {
        set({ notify: false });
        return;
      }
    }
    try {
      localStorage.setItem(NOTIFY_KEY, on ? "1" : "0");
    } catch {}
    set({ notify: on && typeof Notification !== "undefined" });
  },
}));

export function notificationsBlocked(): boolean {
  return typeof Notification === "undefined" || Notification.permission === "denied";
}

/* ───────── Notifier: watches arriving messages ───────── */

function channelPath(channelId: string): { guildId: string; path: string; name: string } | null {
  const g = GUILDS.find((x) => x.channels.some((c) => c.id === channelId));
  const c = g?.channels.find((x) => x.id === channelId);
  return g && c ? { guildId: g.id, path: `/channels/${GUILD_SLUG_BY_ID[g.id]}/${c.name}`, name: c.name } : null;
}

/** Start after boot; returns an unsubscribe function. */
export function startNotifier(navigate: (guildId: string, channelId: string) => void) {
  const seen = new Set(useLounge.getState().messages.map((m) => m.id));
  let lastPing = 0;
  return useLounge.subscribe((s, prev) => {
    if (s.messages === prev.messages) return;
    const viewer = s.users[s.viewerId];
    if (!viewer) return;
    const mine = new Set<string>();
    const fresh: Message[] = [];
    for (const m of s.messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.authorId === s.viewerId || m.id.startsWith("m_local_")) continue;
      if (Date.now() - m.createdAt > 60_000) continue; // history, not news
      fresh.push(m);
    }
    if (!fresh.length) return;
    const current = s.channelByGuild[s.guildId];
    for (const m of s.messages) if (m.authorId === s.viewerId) mine.add(m.id);
    for (const m of fresh) {
      if (s.mutedChannels[m.channelId]) continue;
      const text = messageText(m, s.lang);
      const mentioned = new RegExp(`@${viewer.displayName}\\b`, "i").test(text);
      const repliedTo = !!m.replyToId && mine.has(m.replyToId);
      const away = document.hidden || m.channelId !== current;
      if (!mentioned && !repliedTo) {
        // Quiet pop for activity in the open channel while the tab is in the background.
        if (document.hidden && m.channelId === current && Date.now() - lastPing > 8000) {
          lastPing = Date.now();
          playSound("message");
        }
        continue;
      }
      if (Date.now() - lastPing > 1200) {
        lastPing = Date.now();
        playSound(mentioned ? "mention" : "reply");
      }
      if (useFeel.getState().notify && away && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const author = s.users[m.authorId];
        const where = channelPath(m.channelId);
        try {
          const n = new Notification(`${author?.displayName ?? "Someone"}${where ? ` · #${where.name}` : ""}`, {
            body: plainPreview(text).slice(0, 180) || "📎",
            tag: m.channelId,
            icon: "/icon.svg",
            silent: true,
          });
          n.onclick = () => {
            window.focus();
            if (where) navigate(where.guildId, m.channelId);
            n.close();
          };
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    }
  });
}
