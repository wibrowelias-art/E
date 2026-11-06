"use client";

import { useState } from "react";
import { useLounge } from "@/lib/store";
import { Avatar } from "./Avatar";
import { GearIcon, HeadphonesIcon, HeadphonesOffIcon, MicIcon, MicOffIcon } from "./icons";

/** Desktop account panel floating over the bottom of rail + channel list. */
export function UserPanel() {
  const viewer = useLounge((s) => s.users[s.viewerId]);
  const openProfile = useLounge((s) => s.openProfile);
  const [muted, setMuted] = useState(false);
  const [deaf, setDeaf] = useState(false);
  if (!viewer) return <div className="upanel" />;
  return (
    <div className="upanel">
      <button className="upanel__who" onClick={() => openProfile(viewer.id)} aria-label="Open your profile">
        <Avatar user={viewer} size={32} status ring="var(--bg-surface)" />
        <span className="min-w-0 text-left">
          <div className="upanel__name truncate">{viewer.displayName}</div>
          <div className="upanel__status">
            {viewer.statusEmoji ? `${viewer.statusEmoji} ` : ""}
            {viewer.statusText ?? "Online"}
          </div>
        </span>
      </button>
      <button className="iconbtn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
        {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
      </button>
      <button className="iconbtn" onClick={() => setDeaf((d) => !d)} aria-label={deaf ? "Undeafen" : "Deafen"} aria-pressed={deaf}>
        {deaf ? <HeadphonesOffIcon size={20} /> : <HeadphonesIcon size={20} />}
      </button>
      <button className="iconbtn" aria-label="User settings">
        <GearIcon size={20} />
      </button>
    </div>
  );
}
