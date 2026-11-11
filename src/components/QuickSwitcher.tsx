"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GUILDS } from "@/data/guilds";
import { useLounge, useT } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { Avatar } from "./Avatar";
import { HashIcon, LockIcon, SearchIcon } from "./icons";

type Item =
  | { kind: "channel"; id: string; guildId: string; name: string; guild: string; locked: boolean; unread: boolean; mentions: number }
  | { kind: "user"; id: string; name: string; username: string };

/** prefix > word start > substring > in-order letters; 0 = no match */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 100 - t.length / 100;
  if (t.split(/[\s._/-]+/).some((w) => w.startsWith(q))) return 80;
  if (t.includes(q)) return 60;
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 30 : 0;
}

export function QuickSwitcher({ onGo }: { onGo: (guildId: string, channelId: string) => void }) {
  const open = useUi((s) => s.switcher);
  const setOpen = useUi((s) => s.setSwitcher);
  const role = useLounge((s) => s.role);
  const users = useLounge((s) => s.users);
  const readState = useLounge((s) => s.readState);
  const guildId = useLounge((s) => s.guildId);
  const openProfile = useLounge((s) => s.openProfile);
  const t = useT();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const channels: Item[] = GUILDS.flatMap((g) =>
      g.channels
        .filter((c) => c.kind === "text" && (!c.staffOnly || role === "owner"))
        .map((c) => ({
          kind: "channel" as const,
          id: c.id,
          guildId: g.id,
          name: c.name,
          guild: g.name,
          locked: !!c.staffOnly,
          unread: !!readState[c.id]?.unread,
          mentions: readState[c.id]?.mentions ?? 0,
        })),
    );
    const people: Item[] = Object.values(users)
      .filter((u) => !u.isHuman || u.roleId === "owner")
      .map((u) => ({ kind: "user" as const, id: u.id, name: u.displayName, username: u.username }));
    const raw = q.trim().toLowerCase();
    const only = raw.startsWith("#") ? "channel" : raw.startsWith("@") ? "user" : null;
    const needle = only ? raw.slice(1) : raw;
    if (!needle) {
      const base = only === "user" ? people : only === "channel" ? channels : channels;
      return [...base]
        .sort((a, b) => {
          const ua = a.kind === "channel" ? (a.mentions ? 2 : a.unread ? 1 : 0) + (a.guildId === guildId ? 0.5 : 0) : 0;
          const ub = b.kind === "channel" ? (b.mentions ? 2 : b.unread ? 1 : 0) + (b.guildId === guildId ? 0.5 : 0) : 0;
          return ub - ua;
        })
        .slice(0, 12);
    }
    const pool = only === "channel" ? channels : only === "user" ? people : [...channels, ...people];
    return pool
      .map((it) => ({ it, s: Math.max(score(it.name, needle), it.kind === "user" ? score(it.username, needle) * 0.9 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.it);
  }, [q, users, readState, role, guildId]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const go = (it: Item | undefined) => {
    if (!it) return;
    setOpen(false);
    if (it.kind === "channel") onGo(it.guildId, it.id);
    else openProfile(it.id, { x: window.innerWidth / 2 - 160, y: 120 });
  };

  return (
    <div className="switcher-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="switcher" role="dialog" aria-label={t.switcherPlaceholder} onMouseDown={(e) => e.stopPropagation()}>
        <label className="switcher__field">
          <SearchIcon size={20} />
          <input
            ref={inputRef}
            value={q}
            placeholder={t.switcherPlaceholder}
            aria-label={t.switcherPlaceholder}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(items.length - 1, a + 1));
              else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
              else if (e.key === "Enter") go(items[active]);
              else if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              } else return;
              e.preventDefault();
            }}
          />
        </label>
        <div className="switcher__list scroll-thin" ref={listRef} role="listbox">
          {items.length === 0 && <div className="switcher__empty">{t.noResults}</div>}
          {items.map((it, i) => (
            <button
              key={`${it.kind}-${it.id}`}
              className="switcher__item"
              data-index={i}
              data-active={i === active}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => go(it)}
            >
              {it.kind === "channel" ? (
                <>
                  <span className="switcher__icon">{it.locked ? <LockIcon size={18} /> : <HashIcon size={18} />}</span>
                  <span className="switcher__name" data-unread={it.unread}>
                    {it.name}
                  </span>
                  {it.mentions > 0 && <span className="chanrow__mentions">{it.mentions}</span>}
                  <span className="switcher__meta">{it.guild}</span>
                </>
              ) : (
                <>
                  <span className="switcher__icon">{users[it.id] && <Avatar user={users[it.id]!} size={22} />}</span>
                  <span className="switcher__name">{it.name}</span>
                  <span className="switcher__meta">@{it.username}</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="switcher__hint">{t.switcherHint}</div>
      </div>
    </div>
  );
}
