"use client";

import { Fragment } from "react";
import { FIXTURE_CATEGORIES, FIXTURE_CHANNELS, FIXTURE_SELECTED, FIXTURE_UNREAD } from "@/data/fixture";
import { ROLES } from "@/data/npcs";
import { useCurrentChannel, useCurrentGuild, useLounge } from "@/lib/store";
import type { Category, Channel } from "@/lib/types";
import { Avatar } from "./Avatar";
import {
  BadgeFlower,
  BellIcon,
  ChevronDown,
  ChevronRight,
  DottedCircle,
  HashIcon,
  HeadphonesOffIcon,
  InviteIcon,
  LockIcon,
  MicOffIcon,
  SearchIcon,
  SpeakerIcon,
  StageWaveIcon,
} from "./icons";

const PRESENCE_LABEL = { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Invisible" } as const;

export function ChannelPanel({ onNavigate }: { onNavigate: (channelId: string) => void }) {
  const guild = useCurrentGuild();
  const viewerId = useLounge((s) => s.viewerId);
  const isOwner = guild.ownerId === viewerId;

  return (
    <section className="chanpanel" aria-label={`${guild.name} channels`}>
      <header className="guildhead--desktop">
        <span className="min-w-0 flex-1 truncate">{guild.name}</span>
        <ChevronDown size={18} />
      </header>
      <MobileGuildHeader />
      <div className="chanlist scroll-thin">
        <ChannelList isOwner={isOwner} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function MobileGuildHeader() {
  const guild = useCurrentGuild();
  return (
    <header className="guildhead--mobile">
      <div className="mhead__title">
        <span className="truncate">{guild.name}</span>
        <span className="mhead__badge" style={{ color: ROLES.owner.color ?? undefined }}>
          <BadgeFlower size={22} />
        </span>
        <span className="mhead__chev">
          <ChevronRight size={17} />
        </span>
      </div>
      <div className="mhead__meta">
        <span>{guild.memberIds.length.toLocaleString("en-US")} Members</span>
        <span className="mhead__dot" />
        <span>Community</span>
      </div>
      <div className="mhead__row">
        <button className="mhead__search" aria-label="Search">
          <SearchIcon size={21} />
          <span>Search</span>
        </button>
        <button className="mhead__invite" aria-label="Invite people">
          <InviteIcon size={21} />
        </button>
      </div>
      <div className="mhead__divider" />
    </header>
  );
}

function FixtureList() {
  const row = (c: Channel) => (
    <ChannelRow key={c.id} channel={c} selected={c.id === FIXTURE_SELECTED} unread={FIXTURE_UNREAD.has(c.id)} mentions={0} onClick={() => {}} />
  );
  return (
    <>
      {FIXTURE_CHANNELS.filter((c) => !c.categoryId).map(row)}
      {FIXTURE_CATEGORIES.map((k) => (
        <Fragment key={k.id}>
          <CategoryHeader category={k} collapsed={false} onToggle={() => {}} />
          {FIXTURE_CHANNELS.filter((c) => c.categoryId === k.id).map(row)}
        </Fragment>
      ))}
    </>
  );
}

function ChannelList({ isOwner, onNavigate }: { isOwner: boolean; onNavigate: (id: string) => void }) {
  const fixture = useLounge((s) => s.fixture);
  if (fixture) return <FixtureList />;
  return <RealChannelList isOwner={isOwner} onNavigate={onNavigate} />;
}

function RealChannelList({ isOwner, onNavigate }: { isOwner: boolean; onNavigate: (id: string) => void }) {
  const guild = useCurrentGuild();
  const current = useCurrentChannel();
  const collapsed = useLounge((s) => s.collapsed);
  const toggleCategory = useLounge((s) => s.toggleCategory);
  const readState = useLounge((s) => s.readState);

  const uncategorised = guild.channels.filter((c) => !c.categoryId);
  const cats = guild.categories.filter((k) => !k.staffOnly || isOwner);

  const renderChannel = (c: Channel) => (
    <Fragment key={c.id}>
      <ChannelRow
        channel={c}
        selected={c.id === current.id}
        unread={!!readState[c.id]?.unread && c.id !== current.id}
        mentions={c.id === current.id ? 0 : (readState[c.id]?.mentions ?? 0)}
        onClick={() => c.kind === "text" && onNavigate(c.id)}
      />
      {c.kind === "voice" && <VoiceUsers channelId={c.id} />}
    </Fragment>
  );

  return (
    <>
      {uncategorised.map(renderChannel)}
      {cats.map((k) => {
        const channels = guild.channels.filter((c) => c.categoryId === k.id && (!c.staffOnly || isOwner));
        const isCollapsed = !!collapsed[k.id];
        const visible = isCollapsed
          ? channels.filter((c) => c.id === current.id || readState[c.id]?.unread)
          : channels;
        return (
          <Fragment key={k.id}>
            <CategoryHeader category={k} collapsed={isCollapsed} onToggle={() => toggleCategory(k.id)} />
            {visible.map(renderChannel)}
          </Fragment>
        );
      })}
    </>
  );
}

function CategoryHeader({ category, collapsed, onToggle }: { category: Category; collapsed: boolean; onToggle: () => void }) {
  return (
    <div
      className="chanlist__cat"
      data-collapsed={collapsed}
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}
    >
      <span className="chanlist__cat-chev max-md:hidden">
        <ChevronDown size={12} />
      </span>
      <span className="truncate">
        {category.slashes && <span className="chanlist__cat-slashes">//</span>}
        {category.name}
      </span>
      <span className="chanlist__cat-chev md:hidden" style={{ color: "var(--text-secondary)" }}>
        <ChevronDown size={16} />
      </span>
    </div>
  );
}

function ChannelRow({
  channel,
  selected,
  unread,
  mentions,
  onClick,
}: {
  channel: Channel;
  selected: boolean;
  unread: boolean;
  mentions: number;
  onClick: () => void;
}) {
  const locked = channel.staffOnly || channel.locked;
  const Icon = locked ? LockIcon : channel.kind === "voice" ? SpeakerIcon : HashIcon;
  const iconClass = locked ? "chanrow__icon chanrow__icon--lock" : channel.kind === "voice" ? "chanrow__icon chanrow__icon--voice" : "chanrow__icon";
  return (
    <button
      className="chanrow"
      data-selected={selected}
      data-unread={unread}
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      aria-label={`${channel.kind === "voice" ? "voice channel" : "channel"} ${channel.name}${unread ? ", unread" : ""}${mentions ? `, ${mentions} mentions` : ""}`}
    >
      {unread && <span className="chanrow__unread-dot" />}
      <span className={iconClass}>
        <Icon size={20} />
      </span>
      <span className="chanrow__name">
        {channel.emoji && <span className="chanrow__emoji">{channel.emoji}</span>}
        {channel.emoji && <span className="chanrow__slashes">//</span>}
        {channel.name}
      </span>
      {channel.isNew && !selected && <span className="chanrow__new">NEW</span>}
      {mentions > 0 && <span className="chanrow__mentions">{mentions}</span>}
    </button>
  );
}

function VoiceUsers({ channelId }: { channelId: string }) {
  const users = useLounge((s) => s.users);
  const inVoice = Object.values(users).filter((u) => u.voiceChannelId === channelId);
  if (!inVoice.length) return null;
  return (
    <div className="voiceusers">
      {inVoice.map((u) => (
        <div key={u.id} className="voiceuser" data-speaking={!!u.speaking}>
          <Avatar user={u} size={24} speaking={u.speaking} ring="var(--bg-base-low)" />
          <span className="truncate">{u.displayName}</span>
          <span className="voiceuser__icons">
            {u.speaking && (
              <span className="wave">
                <StageWaveIcon size={14} />
              </span>
            )}
            {u.selfMute && <MicOffIcon size={16} />}
            {u.selfDeaf && <HeadphonesOffIcon size={16} />}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Bottom card on the mobile channel screen (reference: avatar + status + bell). */
export function MobileUserCard() {
  const viewer = useLounge((s) => s.users[s.viewerId]);
  const readState = useLounge((s) => s.readState);
  const total = Object.values(readState).reduce((n, r) => n + r.mentions, 0);
  if (!viewer) return <div className="mcard" />;
  return (
    <div className="mcard">
      <div className="mcard__avatar">
        <Avatar user={viewer} size={66} />
        <span className="mcard__status">
          <StatusDotOnly presence={viewer.presence} />
        </span>
      </div>
      <div className="mcard__meta">
        <div className="mcard__icons">
          <DottedCircle size={14} />
          <span style={{ color: "var(--text-strong)" }}>
            <ChevronDown size={18} style={{ strokeWidth: 3 }} />
          </span>
        </div>
        <div className="mcard__status-text">{PRESENCE_LABEL[viewer.presence]}</div>
      </div>
      <button className="mcard__bell" aria-label={`Notifications${total ? `, ${total} unread` : ""}`}>
        <BellIcon size={19} />
        {total > 0 && <span className="mcard__badge">{total}</span>}
      </button>
    </div>
  );
}

function StatusDotOnly({ presence }: { presence: keyof typeof PRESENCE_LABEL }) {
  const color =
    presence === "online"
      ? "var(--status-online)"
      : presence === "idle"
        ? "var(--status-idle)"
        : presence === "dnd"
          ? "var(--status-dnd)"
          : "var(--status-offline)";
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="8" fill={color} />
      {presence === "offline" && <circle cx="8" cy="8" r="3.6" fill="var(--bg-base-low)" />}
    </svg>
  );
}
