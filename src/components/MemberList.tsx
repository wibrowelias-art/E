"use client";

import { type MouseEvent } from "react";
import { ROLES } from "@/data/npcs";
import { useCurrentGuild, useLounge } from "@/lib/store";
import type { User } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CrownIcon, StageWaveIcon } from "./icons";

const ORDER: Record<User["roleId"], number> = { owner: 0, inner: 1, bot: 2, regular: 3, tourist: 4 };

function sortMembers(a: User, b: User) {
  return ORDER[a.roleId] - ORDER[b.roleId] || a.displayName.localeCompare(b.displayName);
}

function MemberRow({ user, voiceName }: { user: User; voiceName?: string }) {
  const openProfile = useLounge((s) => s.openProfile);
  const color = user.presence === "offline" ? "var(--text-muted)" : (ROLES[user.roleId].color ?? "var(--text-strong)");
  const onClick = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openProfile(user.id, { x: Math.max(8, r.left - 316), y: r.top });
  };
  const sub = voiceName ? `In ${voiceName}` : user.statusText ? `${user.statusEmoji ? `${user.statusEmoji} ` : ""}${user.statusText}` : null;
  return (
    <button className="member" data-offline={user.presence === "offline"} onClick={onClick} aria-label={`${user.displayName}, ${user.presence}`}>
      <Avatar user={user} size={32} status={user.presence !== "offline"} ring="var(--bg-base-low)" speaking={!!voiceName && user.speaking} />
      <span className="min-w-0 flex-1">
        <span className="member__name" style={{ color }}>
          <span className="truncate">{user.displayName}</span>
          {user.roleId === "owner" && (
            <span style={{ color: "var(--mention)" }} title="Server owner" className="flex shrink-0">
              <CrownIcon size={14} />
            </span>
          )}
          {user.isBot && <span className="msg__tag" style={{ top: 0 }}>APP</span>}
          {voiceName && user.speaking && (
            <span className="wave flex shrink-0">
              <StageWaveIcon size={12} />
            </span>
          )}
        </span>
        {sub && <span className="member__status block">{sub}</span>}
      </span>
    </button>
  );
}

export function MemberList() {
  const guild = useCurrentGuild();
  const users = useLounge((s) => s.users);
  const ready = useLounge((s) => s.ready);
  const toggleMembers = useLounge((s) => s.toggleMembers);
  const members = guild.memberIds.map((id) => users[id]).filter((u): u is User => !!u);
  const voiceChannels = new Map(guild.channels.filter((c) => c.kind === "voice").map((c) => [c.id, c.name]));

  const inVoice = members.filter((u) => u.voiceChannelId && voiceChannels.has(u.voiceChannelId) && u.presence !== "offline").sort(sortMembers);
  const voiceIds = new Set(inVoice.map((u) => u.id));
  const online = members.filter((u) => u.presence !== "offline" && !voiceIds.has(u.id)).sort(sortMembers);
  const offline = members.filter((u) => u.presence === "offline").sort(sortMembers);

  return (
    <>
      <aside className="members scroll-thin" aria-label="Members">
        {!ready ? (
          <div className="flex flex-col gap-3 px-4 pt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skel h-8 w-8 rounded-full" />
                <div className="skel h-3.5" style={{ width: `${40 + ((i * 37) % 45)}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {inVoice.length > 0 && (
              <>
                <h3 className="members__section">In voice — {inVoice.length}</h3>
                {inVoice.map((u) => (
                  <MemberRow key={u.id} user={u} voiceName={voiceChannels.get(u.voiceChannelId!)} />
                ))}
              </>
            )}
            <h3 className="members__section">Online — {online.length}</h3>
            {online.map((u) => (
              <MemberRow key={u.id} user={u} />
            ))}
            <h3 className="members__section">Offline — {offline.length}</h3>
            {offline.map((u) => (
              <MemberRow key={u.id} user={u} />
            ))}
          </>
        )}
      </aside>
      <div className="members-scrim" onClick={() => toggleMembers(false)} aria-hidden />
    </>
  );
}
