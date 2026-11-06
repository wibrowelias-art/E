"use client";

import { NPC_PROFILES, ROLES } from "@/data/npcs";
import { useLounge, useT } from "@/lib/store";
import { Avatar } from "./Avatar";

export function ProfilePopout() {
  const userId = useLounge((s) => s.profileUserId);
  const anchor = useLounge((s) => s.profileAnchor);
  const user = useLounge((s) => (s.profileUserId ? s.users[s.profileUserId] : undefined));
  const close = useLounge((s) => s.openProfile);
  const t = useT();
  if (!userId || !user) return null;
  const role = ROLES[user.roleId];
  const profile = NPC_PROFILES.find((p) => p.userId === user.id);
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const left = vw < 768 ? (vw - 300) / 2 : Math.min(Math.max(8, anchor?.x ?? vw / 2 - 150), vw - 308);
  const top = Math.min(Math.max(8, anchor?.y ?? 120), vh - 420);

  return (
    <>
      <div className="popout-backdrop" onClick={() => close(null)} />
      <div className="popout" style={{ left, top }} role="dialog" aria-label={`${user.displayName} profile`}>
        <div className="popout__banner" style={{ background: `linear-gradient(135deg, ${user.avatar.from}, ${user.avatar.to})` }} />
        <div className="popout__body">
          <div className="popout__avatar">
            <Avatar user={user} size={80} status ring="var(--bg-floating)" />
          </div>
          <div className="popout__name">{user.displayName}</div>
          <div className="popout__user">
            {user.username}
            {user.statusText ? ` · ${user.statusEmoji ?? ""} ${user.statusText}` : ` · ${t.presenceOther[user.presence]}`}
          </div>
          <div className="popout__card">
            {profile && (
              <>
                <div className="popout__label">{t.aboutMe}</div>
                <p className="m-0 mb-3">{profile.bio}</p>
                <div className="popout__label">{t.basedIn}</div>
                <p className="m-0 mb-3">
                  {profile.district ? `${profile.district}, ` : ""}
                  {profile.city === "online" ? "online" : profile.city}
                </p>
              </>
            )}
            {user.id === "u_elias" && (
              <>
                <div className="popout__label">{t.aboutMe}</div>
                <p className="m-0 mb-3">{t.ownerAbout}</p>
              </>
            )}
            <div className="popout__label">{t.roles}</div>
            <span className="role-chip">
              <i style={{ background: role.color ?? "var(--text-muted)" }} />
              {role.name}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
