"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GUILD_SLUG_BY_ID, GUILDS } from "@/data/guilds";
import { useLounge, useT, messageText } from "@/lib/store";
import { placeInViewport, useUi } from "@/lib/ui";
import { rememberEmoji } from "./EmojiPicker";
import { AtIcon, BellIcon, BellOffIcon, CheckAllIcon, CloseIcon, CopyIcon, EditIcon, LinkIcon, ReactIcon, ReplyIcon } from "./icons";

const QUICK = ["🔥", "😭", "🫶", "💀"];

function Item({ icon, label, onClick, danger }: { icon?: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className="cm__item" role="menuitem" data-danger={danger || undefined} onClick={onClick}>
      <span className="truncate">{label}</span>
      {icon && <span className="cm__icon">{icon}</span>}
    </button>
  );
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    useLounge.getState().showToast(done, "info");
  } catch {
    useLounge.getState().showToast(text, "info");
  }
}

function channelUrl(channelId: string, messageId?: string) {
  const g = GUILDS.find((x) => x.channels.some((c) => c.id === channelId));
  const c = g?.channels.find((x) => x.id === channelId);
  if (!g || !c) return window.location.origin;
  return `${window.location.origin}/channels/${GUILD_SLUG_BY_ID[g.id]}/${c.name}${messageId ? `?m=${messageId}` : ""}`;
}

export function ContextMenu() {
  const menu = useUi((s) => s.menu);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const close = () => useUi.setState({ menu: null });

  useLayoutEffect(() => {
    if (!menu) return setPos(null);
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 260;
    setPos(placeInViewport(menu.x, menu.y, w, h));
    requestAnimationFrame(() => el?.querySelector<HTMLButtonElement>(".cm__item, .cm__quick button")?.focus({ preventScroll: true }));
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onScroll = () => close();
    window.addEventListener("resize", onScroll);
    return () => window.removeEventListener("resize", onScroll);
  }, [menu]);

  if (!menu) return null;
  const st = useLounge.getState();
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  let items: ReactNode = null;

  if (menu.target.kind === "message") {
    const m = st.messages.find((x) => x.id === menu.target.id);
    if (!m) return null;
    const own = m.authorId === st.viewerId;
    items = (
      <>
        <div className="cm__quick" role="group" aria-label={t.addReaction}>
          {QUICK.map((e) => (
            <button
              key={e}
              aria-label={`React ${e}`}
              onClick={run(() => {
                rememberEmoji(e);
                st.toggleReaction(m.id, e);
              })}
            >
              {e}
            </button>
          ))}
        </div>
        <Item icon={<ReactIcon size={16} />} label={t.addReaction} onClick={() => useUi.getState().openPicker({ x: menu.x + 220, y: menu.y + 40 }, { kind: "react", messageId: m.id })} />
        <div className="cm__sep" />
        {own && !m.pending && !m.failed && <Item icon={<EditIcon size={15} />} label={t.edit} onClick={run(() => st.startEdit(m.id))} />}
        <Item icon={<ReplyIcon size={16} />} label={t.reply} onClick={run(() => st.setReplyingTo(m.id))} />
        <Item icon={<CopyIcon size={15} />} label={t.copyText} onClick={run(() => void copy(messageText(m, st.lang), t.copied))} />
        <div className="cm__sep" />
        <Item icon={<BellIcon size={15} />} label={t.markUnread} onClick={run(() => st.markUnread(m.id))} />
        <Item icon={<LinkIcon size={15} />} label={t.copyLink} onClick={run(() => void copy(channelUrl(m.channelId, m.id), t.copied))} />
      </>
    );
  } else if (menu.target.kind === "channel") {
    const id = menu.target.id;
    const muted = !!st.mutedChannels[id];
    items = (
      <>
        <Item icon={<CheckAllIcon size={16} />} label={t.markRead} onClick={run(() => st.markRead(id))} />
        <div className="cm__sep" />
        <Item icon={muted ? <BellIcon size={15} /> : <BellOffIcon size={15} />} label={muted ? t.unmuteChannel : t.muteChannel} onClick={run(() => st.toggleMuteChannel(id))} />
        <Item icon={<LinkIcon size={15} />} label={t.copyChannelLink} onClick={run(() => void copy(channelUrl(id), t.copied))} />
      </>
    );
  } else {
    const u = st.users[menu.target.id];
    if (!u) return null;
    items = (
      <>
        <Item label={t.profile} onClick={run(() => st.openProfile(u.id, { x: menu.x, y: menu.y }))} />
        <Item icon={<AtIcon size={15} />} label={t.mention} onClick={run(() => useUi.getState().insertText(`@${u.displayName} `))} />
        <div className="cm__sep" />
        <Item icon={<CopyIcon size={15} />} label={t.copyUsername} onClick={run(() => void copy(u.username, t.copied))} />
      </>
    );
  }

  return (
    <>
      <div className="cm-backdrop" onClick={close} onContextMenu={(e) => (e.preventDefault(), close())} />
      <div
        ref={ref}
        className="cm"
        role="menu"
        style={pos ?? { left: menu.x, top: menu.y, visibility: "hidden" }}
        onKeyDown={(e) => {
          const list = [...(ref.current?.querySelectorAll<HTMLButtonElement>(".cm__item") ?? [])];
          const i = list.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === "ArrowDown") list[(i + 1) % list.length]?.focus();
          else if (e.key === "ArrowUp") list[(i - 1 + list.length) % list.length]?.focus();
          else if (e.key === "Escape") {
            e.stopPropagation();
            close();
          } else return;
          e.preventDefault();
        }}
      >
        {items}
      </div>
    </>
  );
}

export function Lightbox() {
  const box = useUi((s) => s.lightbox);
  if (!box) return null;
  const close = () => useUi.setState({ lightbox: null });
  return (
    <div className="lightbox" role="dialog" aria-label={box.alt} onClick={close}>
      <img src={box.url} alt={box.alt} onClick={(e) => e.stopPropagation()} />
      <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
        <a href={box.url} target="_blank" rel="noreferrer noopener">
          {box.alt}
        </a>
        <button className="iconbtn" onClick={close} aria-label="Close">
          <CloseIcon size={20} />
        </button>
      </div>
    </div>
  );
}
