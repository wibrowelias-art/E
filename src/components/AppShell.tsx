"use client";

import { useCallback, useEffect, useState } from "react";
import { GUILD_SLUG_BY_ID, GUILD_SLUGS, GUILDS } from "@/data/guilds";
import { useCurrentGuild, useLounge, type MobilePane } from "@/lib/store";
import { GuildGlyph } from "./Brand";
import { ChannelPanel, MobileUserCard } from "./ChannelPanel";
import { Chat } from "./Chat";
import { HelpIcon, InboxIcon } from "./icons";
import { ProfilePopout } from "./ProfilePopout";
import { ServerRail } from "./ServerRail";
import { UserPanel } from "./UserPanel";

interface Props {
  guildSlug?: string;
  channelName?: string;
  initialPane: MobilePane;
}

function TitleBar() {
  const guild = useCurrentGuild();
  return (
    <div className="titlebar">
      <span className="titlebar__icon [&>svg]:h-full [&>svg]:w-full">
        <GuildGlyph guild={guild} size={18} />
      </span>
      <span>{guild.name}</span>
      <div className="titlebar__right">
        <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Inbox">
          <InboxIcon size={20} />
        </button>
        <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Help">
          <HelpIcon size={20} />
        </button>
      </div>
    </div>
  );
}

export function AppShell({ guildSlug, channelName, initialPane }: Props) {
  const hydrate = useLounge((s) => s.hydrate);
  const mobilePane = useLounge((s) => s.mobilePane);
  const membersOpen = useLounge((s) => s.membersOpen);
  const [frame, setFrame] = useState<string | undefined>();

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
    const delay = Number(params.get("delay") ?? 0);
    const t = setTimeout(() => hydrate(Date.now()), delay);
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

  // Global keyboard: Esc closes popouts / reply / edit / drawers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const st = useLounge.getState();
      if (st.closeOverlays()) return;
      if (st.membersOpen && window.innerWidth < 1200) st.toggleMembers(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app" data-pane={mobilePane} data-members={membersOpen} data-frame={frame}>
      <TitleBar />
      <div className="app-body">
        <nav className="nav" aria-label="Servers and channels">
          <ServerRail />
          <ChannelPanel onNavigate={navigate} />
          <MobileUserCard />
        </nav>
        <Chat />
      </div>
      <UserPanel />
      <ProfilePopout />
    </div>
  );
}
