"use client";

import { useCallback, useEffect, useState } from "react";
import { GUILD_SLUG_BY_ID, GUILD_SLUGS, GUILDS } from "@/data/guilds";
import { api } from "@/lib/api";
import { useSimulation } from "@/lib/sim/engine";
import type { TypingEntry } from "@/lib/store";
import type { Message, User } from "@/lib/types";
import { useLounge, type MobilePane } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { Backstage } from "./Backstage";
import { SettingsMenu } from "./SettingsMenu";
import { ChannelPanel, MobileUserCard } from "./ChannelPanel";
import { Chat } from "./Chat";
import { EmojiPicker } from "./EmojiPicker";
import { ContextMenu, Lightbox } from "./Overlays";
import { ProfilePopout } from "./ProfilePopout";
import { ServerRail } from "./ServerRail";

interface Props {
  guildSlug?: string;
  channelName?: string;
  initialPane: MobilePane;
}

function Toast() {
  const toast = useLounge((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" data-kind={toast.kind} role="status" aria-live="polite">
      {toast.text}
    </div>
  );
}

/** Poll for new/edited messages, reactions and presence (spec: every 1–2s). */
function usePoller(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const st = useLounge.getState();
      try {
        const res = await api<{ messages: Message[]; users: User[]; rev: number; serverNow: number; typing: TypingEntry[] }>(
          `/api/poll?since=${st.rev}&after=${st.serverNow}`,
        );
        if (!stopped) st.mergeServer(res.messages, res.users, res.rev, res.serverNow, res.typing);
      } catch {
        /* transient — try again on the next tick */
      }
      if (!stopped) timer = setTimeout(tick, document.hidden ? 6000 : 1500);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled]);
}

/**
 * Local mode only: without a database each browser runs its own floor (one tab,
 * via the Web Locks API). With a database the server runs the floor (Phase 3).
 */
function useFloorRunner(wanted: boolean, shared: boolean) {
  const [holder, setHolder] = useState(false);
  useEffect(() => {
    if (!wanted) return setHolder(false);
    if (!shared || typeof navigator === "undefined" || !("locks" in navigator)) {
      setHolder(true);
      return;
    }
    const abort = new AbortController();
    let release: () => void = () => {};
    navigator.locks
      .request("lounge-floor", { signal: abort.signal }, () => {
        setHolder(true);
        return new Promise<void>((resolve) => (release = resolve));
      })
      .catch(() => {});
    return () => {
      abort.abort();
      release();
      setHolder(false);
    };
  }, [wanted, shared]);
  return holder;
}

export function AppShell({ guildSlug, channelName, initialPane }: Props) {
  const boot = useLounge((s) => s.boot);
  const mobilePane = useLounge((s) => s.mobilePane);
  const membersOpen = useLounge((s) => s.membersOpen);
  const ready = useLounge((s) => s.ready);
  const fixture = useLounge((s) => s.fixture);
  const persistence = useLounge((s) => s.persistence);
  const role = useLounge((s) => s.role);
  const [frame, setFrame] = useState<string | undefined>();
  const [simOn, setSimOn] = useState(false);
  usePoller(ready && persistence);
  const runsFloor = useFloorRunner(ready && simOn && !fixture && !persistence, false);
  useSimulation(runsFloor);

  // Hydrate client-side only: timestamps are relative to the visitor's clock.
  useEffect(() => {
    const st = useLounge.getState();
    const guildId = (guildSlug && GUILD_SLUGS[guildSlug]) || st.guildId;
    const guild = GUILDS.find((g) => g.id === guildId)!;
    const channel = channelName ? guild.channels.find((c) => c.name === channelName && c.kind === "text") : undefined;
    useLounge.setState({
      guildId,
      mobilePane: initialPane,
      membersOpen: window.innerWidth >= 1200,
      channelByGuild: channel ? { ...st.channelByGuild, [guildId]: channel.id } : st.channelByGuild,
    });
    if (channel) useLounge.getState().selectChannel(channel.id, { openChat: false });
    const params = new URLSearchParams(window.location.search);
    setFrame(params.get("frame") ?? undefined);
    if (params.get("fixture") === "ref") useLounge.setState({ fixture: true, typing: {} });
    useLounge.getState().loadPrefs();
    const lang = params.get("lang");
    if (lang === "en" || lang === "de") useLounge.getState().setLang(lang);
    document.documentElement.lang = useLounge.getState().lang;
    setSimOn(params.get("sim") !== "off");
    if (params.has("debug")) (window as unknown as { __lounge: typeof useLounge }).__lounge = useLounge;
    const delay = Number(params.get("delay") ?? 0);
    const forceLocal = params.get("local") === "1" || params.get("fixture") === "ref";
    const t = setTimeout(() => {
      void boot({ now: Date.now(), forceLocal }).then(() => {
        if (params.get("backstage") === "1") useLounge.getState().openBackstage(true);
      });
    }, delay);
    const tick = setInterval(() => useLounge.setState({ now: Date.now() }), 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync without a full navigation.
  const navigate = useCallback((channelId: string) => {
    const st = useLounge.getState();
    st.selectChannel(channelId);
    const guild = GUILDS.find((g) => g.id === st.guildId)!;
    const ch = guild.channels.find((c) => c.id === channelId);
    if (ch) window.history.pushState(null, "", `/channels/${GUILD_SLUG_BY_ID[guild.id]}/${ch.name}${window.location.search}`);
  }, []);

  // Global keyboard: Esc closes the top-most overlay; with nothing open it marks the channel read.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (useUi.getState().closeTop()) return;
      const st = useLounge.getState();
      if (st.closeOverlays()) return;
      if (st.membersOpen && window.innerWidth < 1200) return st.toggleMembers(false);
      st.markRead(st.channelByGuild[st.guildId]!);
    };
    const onVisible = () => {
      if (!document.hidden) useLounge.getState().seeCurrent();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="app" data-pane={mobilePane} data-members={membersOpen} data-frame={frame}>
      <div className="app-body">
        <nav className="nav" aria-label="Servers and channels">
          <ServerRail />
          <ChannelPanel onNavigate={navigate} />
          <MobileUserCard />
        </nav>
        <Chat />
      </div>
      <ProfilePopout />
      <ContextMenu />
      <EmojiPicker />
      <Lightbox />
      <SettingsMenu />
      <Backstage />
      <Toast />
    </div>
  );
}
