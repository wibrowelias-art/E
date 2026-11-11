"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { NPC_PROFILES, ROLES } from "@/data/npcs";
import { useLounge, useT } from "@/lib/store";
import { placeInViewport, useUi } from "@/lib/ui";
import { Avatar, StatusGlyph } from "./Avatar";
import { CrownIcon } from "./icons";

/** Stable "member since" per user (the seed has no join dates). */
function memberSince(id: string, locale: string): string {
  if (id === "u_elias") return new Date(2023, 9, 3).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const d = new Date(2024, 0, 1 + (h % 600));
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function ProfilePopout() {
  const userId = useLounge((s) => s.profileUserId);
  const anchor = useLounge((s) => s.profileAnchor);
  const user = useLounge((s) => (s.profileUserId ? s.users[s.profileUserId] : undefined));
  const viewerId = useLounge((s) => s.viewerId);
  const close = useLounge((s) => s.openProfile);
  const canPost = useLounge((s) => s.canPost(s.channelByGuild[s.guildId]!));
  const insertText = useUi((s) => s.insertText);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [note, setNote] = useState("");

  useLayoutEffect(() => {
    setNote("");
    if (!userId) return setPos(null);
    const h = ref.current?.offsetHeight ?? 420;
    const vw = window.innerWidth;
    setPos(vw < 768 ? { left: (vw - 320) / 2, top: Math.max(8, window.innerHeight - h - 12) } : placeInViewport(anchor?.x ?? vw / 2 - 160, anchor?.y ?? 120, 320, h));
  }, [userId, anchor]);

  if (!userId || !user) return null;
  const role = ROLES[user.roleId];
  const profile = NPC_PROFILES.find((p) => p.userId === user.id);
  const about = user.id === "u_elias" ? t.ownerAbout : profile?.bio;
  const place = profile ? `${profile.district ? `${profile.district}, ` : ""}${profile.city}` : null;
  const self = user.id === viewerId;

  return (
    <>
      <div className="popout-backdrop" onClick={() => close(null)} />
      <div ref={ref} className="popout" style={pos ?? { visibility: "hidden", left: 0, top: 0 }} role="dialog" aria-label={`${user.displayName} profile`}>
        <div className="popout__banner" style={{ background: `linear-gradient(135deg, ${user.avatar.from}, ${user.avatar.to})` }} />
        <div className="popout__body">
          <div className="popout__avatar">
            <Avatar user={user} size={80} status ring="var(--bg-floating)" dot={18} />
          </div>
          <div className="popout__name">
            {user.displayName}
            {user.roleId === "owner" && (
              <span style={{ color: "var(--owner)" }} title={t.serverOwner}>
                <CrownIcon size={16} />
              </span>
            )}
          </div>
          <div className="popout__user">@{user.username}</div>
          <div className="popout__presence">
            <StatusGlyph presence={user.presence} size={10} ring="var(--bg-floating)" />
            <span>{t.presenceOther[user.presence]}</span>
            {user.statusText && (
              <span className="truncate">
                · {user.statusEmoji ? `${user.statusEmoji} ` : ""}
                {user.statusText}
              </span>
            )}
          </div>
          <div className="popout__card">
            {about && (
              <section>
                <div className="popout__label">{t.aboutMe}</div>
                <p>{about}</p>
              </section>
            )}
            {place && (
              <section>
                <div className="popout__label">{t.basedIn}</div>
                <p>{place}</p>
              </section>
            )}
            <section>
              <div className="popout__label">{t.memberSince}</div>
              <p>{memberSince(user.id, t.locale)}</p>
            </section>
            <section>
              <div className="popout__label">{t.roles}</div>
              <span className="role-chip">
                <i style={{ background: role.color ?? "var(--text-muted)" }} />
                {role.name}
              </span>
            </section>
          </div>
          {!self && canPost && (
            <form
              className="popout__msg"
              onSubmit={(e) => {
                e.preventDefault();
                insertText(`@${user.displayName} ${note.trim()}`);
                close(null);
              }}
            >
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.messageUser(user.displayName)} aria-label={t.messageUser(user.displayName)} />
            </form>
          )}
        </div>
      </div>
    </>
  );
}
