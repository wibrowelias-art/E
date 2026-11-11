"use client";

import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { useUi } from "@/lib/ui";
import { ROLES } from "@/data/npcs";
import { clock, fullTimestamp, headerTime, shortHeaderTime } from "@/lib/format";
import { firstLink, isJumboEmoji, plainPreview, renderMarkup, type MarkupContext } from "@/lib/markup";
import type { Attachment, Message, User } from "@/lib/types";
import type { Lang, Strings } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { CrownIcon, EditIcon, MoreIcon, ReactIcon, ReplyIcon } from "./icons";

export interface MessageRowProps {
  message: Message;
  author: User;
  groupStart: boolean;
  replyTo?: { message: Message; author: User } | null;
  now: number;
  lang: Lang;
  t: Strings;
  /** Text in the current language */
  text: string;
  replyText?: string;
  viewerId: string;
  mentioned: boolean;
  editing: boolean;
  replying: boolean;
  markup: MarkupContext;
  onReply: (id: string) => void;
  onEdit: (id: string | null) => void;
  onSaveEdit: (id: string, content: string) => void;
  onReact: (id: string, emoji: string) => void;
  onProfile: (userId: string, anchor: { x: number; y: number }) => void;
  onJumpTo: (id: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

const QUICK = ["🔥", "😭", "🫶"];

interface Preview {
  url: string;
  site?: string;
  title?: string;
  description?: string;
  image?: string;
  color?: string;
}
const previewCache = new Map<string, Promise<Preview | null>>();
function loadPreview(url: string): Promise<Preview | null> {
  let p = previewCache.get(url);
  if (!p) {
    p = api<{ preview: Preview | null }>(`/api/unfurl?url=${encodeURIComponent(url)}`)
      .then((r) => r.preview)
      .catch(() => null);
    previewCache.set(url, p);
  }
  return p;
}

function LinkEmbed({ url }: { url: string }) {
  const [p, setP] = useState<Preview | null | undefined>(undefined);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => {
    let live = true;
    void loadPreview(url).then((x) => live && setP(x));
    return () => {
      live = false;
    };
  }, [url]);
  if (!p) return null;
  return (
    <div className="embed" style={p.color ? ({ "--embed-color": p.color } as CSSProperties) : undefined}>
      <div className="embed__text">
        {p.site && <div className="embed__site">{p.site}</div>}
        {p.title && (
          <a className="embed__title" href={p.url} target="_blank" rel="noreferrer noopener">
            {p.title}
          </a>
        )}
        {p.description && <div className="embed__desc">{p.description}</div>}
      </div>
      {p.image && imgOk && (
        <img className="embed__image" src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
      )}
    </div>
  );
}

function nameColor(user: User): string {
  return ROLES[user.roleId].color ?? "var(--text-strong)";
}

function AttachmentArt({ a }: { a: Attachment }) {
  const openLightbox = useUi((s) => s.openLightbox);
  const ratio = a.width / a.height;
  if (a.url) {
    const w = Math.min(400, a.width, 300 * ratio);
    return (
      <button className="attachment attachment--img" style={{ width: w, aspectRatio: `${a.width} / ${a.height}` }} onClick={() => openLightbox(a.url!, a.filename)}>
        <img src={a.url} alt={a.filename} loading="lazy" draggable={false} />
        {a.mime === "image/gif" && <span className="attachment__gif">GIF</span>}
      </button>
    );
  }
  const palette = a.palette ?? ["#1f2329", "#121519", "#f2a93b"];
  const h = Math.min(300, 400 / ratio);
  const style: CSSProperties = {
    aspectRatio: `${a.width} / ${a.height}`,
    maxHeight: 300,
    height: h,
    background: `radial-gradient(ellipse at 28% 72%, ${palette[2]}cc 0%, transparent 42%),
      radial-gradient(ellipse at 78% 22%, ${palette[2]}55 0%, transparent 38%),
      linear-gradient(165deg, ${palette[0]} 0%, ${palette[1]} 70%, ${palette[0]} 100%)`,
  };
  return (
    <div className="attachment" style={style} role="img" aria-label={`Photo ${a.filename}`}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.22] mix-blend-overlay" aria-hidden>
        <filter id={`grain-${a.id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${a.id})`} />
      </svg>
      <span className="attachment__label">{a.filename}</span>
    </div>
  );
}

function EditBox({ initial, onSave, onCancel, t }: { initial: string; onSave: (v: string) => void; onCancel: () => void; t: Strings }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <div>
      <div className="editbox">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSave(value);
            }
          }}
        />
      </div>
      <div className="editbox__hint">
        {t.editHint[0]}
        <b onClick={onCancel}>{t.editHint[1]}</b>
        {t.editHint[2]}
        <b onClick={() => onSave(value)}>{t.editHint[3]}</b>
      </div>
    </div>
  );
}

export const MessageRow = memo(function MessageRow(p: MessageRowProps) {
  const { message, author, groupStart, replyTo } = p;
  const isOwn = message.authorId === p.viewerId;
  const showHeader = groupStart || !!replyTo;
  const jumbo = !message.attachments?.length && isJumboEmoji(p.text);
  const link = message.pending || message.failed ? null : firstLink(p.text);
  const menuOpen = useUi((s) => (s.menu?.target.kind === "message" && s.menu.target.id === message.id) || (s.picker?.target.kind === "react" && s.picker.target.messageId === message.id));
  const openMenu = useUi((s) => s.openMenu);
  const openPicker = useUi((s) => s.openPicker);

  const profile = (e: MouseEvent, userId: string) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    p.onProfile(userId, { x: r.right + 8, y: r.top });
  };
  const userMenu = (e: MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({ x: e.clientX, y: e.clientY }, { kind: "user", id: userId });
  };
  const pickerAt = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openPicker({ x: r.right, y: r.top }, { kind: "react", messageId: message.id });
  };

  return (
    <div
      className={`msg ${showHeader ? "msg--group" : ""}`}
      data-mentioned={p.mentioned}
      data-replying={p.replying}
      data-active={p.editing}
      data-menu={menuOpen || undefined}
      onContextMenu={(e) => {
        if (p.editing || (e.target as HTMLElement).closest("a, textarea")) return;
        e.preventDefault();
        openMenu({ x: e.clientX, y: e.clientY }, { kind: "message", id: message.id });
      }}
      data-pending={message.pending || undefined}
      data-failed={message.failed ? true : undefined}
      id={`msg-${message.id}`}
      role="article"
      aria-label={`${author.displayName}, ${clock(message.createdAt, p.lang)}`}
    >
      {replyTo && (
        <div className="msg__reply" onClick={() => p.onJumpTo(replyTo.message.id)}>
          <Avatar user={replyTo.author} size={16} />
          <span className="msg__reply-name" style={{ color: nameColor(replyTo.author) }}>
            @{replyTo.author.displayName}
          </span>
          <span className="msg__reply-text">{plainPreview(p.replyText ?? replyTo.message.content)}</span>
        </div>
      )}

      {showHeader ? (
        <>
          <span className="msg__avatar" onClick={(e) => profile(e, author.id)} onContextMenu={(e) => userMenu(e, author.id)}>
            <span className="max-md:hidden">
              <Avatar user={author} size={40} />
            </span>
            <span className="md:hidden">
              <Avatar user={author} size={44} />
            </span>
          </span>
          <div className="msg__header">
            <span
              className="msg__name"
              style={{ color: nameColor(author) }}
              onClick={(e) => profile(e, author.id)}
              onContextMenu={(e) => userMenu(e, author.id)}
            >
              {author.displayName}
            </span>
            {author.roleId === "owner" && (
              <span style={{ color: "var(--mention)" }} title={p.t.serverOwner} className="relative top-[2px]">
                <CrownIcon size={14} />
              </span>
            )}
            {author.isBot && <span className="msg__tag">BOT</span>}
            <time className="msg__time" dateTime={new Date(message.createdAt).toISOString()} title={fullTimestamp(message.createdAt, p.lang)}>
              <span className="max-md:hidden">{headerTime(message.createdAt, p.now, p.lang)}</span>
              <span className="md:hidden">{shortHeaderTime(message.createdAt, p.now, p.lang)}</span>
            </time>
          </div>
        </>
      ) : (
        <time className="msg__gutter-time" title={fullTimestamp(message.createdAt, p.lang)}>
          {clock(message.createdAt, p.lang)}
        </time>
      )}

      {p.editing ? (
        <EditBox initial={message.content} onSave={(v) => p.onSaveEdit(message.id, v)} onCancel={() => p.onEdit(null)} t={p.t} />
      ) : (
        (p.text || message.editedAt) && (
          <div className={`msg__content ${jumbo ? "msg__content--jumbo" : ""}`}>
            {renderMarkup(p.text, p.markup)}
            {message.editedAt && <span className="msg__edited">{p.t.edited}</span>}
          </div>
        )
      )}

      {message.failed && (
        <div className="msg__failed" role="alert">
          <span>{message.failed}</span>
          <button onClick={() => p.onRetry(message.id)}>{p.t.retry}</button>
          <button onClick={() => p.onDiscard(message.id)}>{p.t.discard}</button>
        </div>
      )}

      {!!message.attachments?.length && (
        <div className="attachments">
          {message.attachments.map((a) => (
            <AttachmentArt key={a.id} a={a} />
          ))}
        </div>
      )}

      {link && !p.editing && <LinkEmbed url={link} />}

      {!!message.reactions?.length && (
        <div className="reactions">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              className="reaction"
              data-me={r.me}
              aria-pressed={r.me}
              aria-label={`${r.emoji} ${r.count} reactions`}
              title={p.t.reactedBy(r.emoji, r.count)}
              onClick={() => p.onReact(message.id, r.emoji)}
            >
              <span className="reaction__emoji">{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          ))}
          <button className="reaction reaction--add" aria-label={p.t.addReaction} title={p.t.addReaction} onClick={pickerAt}>
            <ReactIcon size={16} />
          </button>
        </div>
      )}

      {!p.editing && (
        <div className="msg__toolbar" role="toolbar" aria-label="Message actions">
          {QUICK.map((e) => (
            <button key={e} className="quick-react" onClick={() => p.onReact(message.id, e)} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
          <span className="msg__toolbar-sep" />
          <button className="iconbtn" aria-label={p.t.addReaction} title={p.t.addReaction} onClick={pickerAt}>
            <ReactIcon size={18} />
          </button>
          {isOwn && !message.pending && !message.failed && (
            <button className="iconbtn" aria-label={p.t.edit} title={p.t.edit} onClick={() => p.onEdit(message.id)}>
              <EditIcon size={17} />
            </button>
          )}
          <button className="iconbtn" aria-label={p.t.reply} title={p.t.reply} onClick={() => p.onReply(message.id)}>
            <ReplyIcon size={18} />
          </button>
          <button
            className="iconbtn"
            aria-label={p.t.more}
            title={p.t.more}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openMenu({ x: r.left - 200, y: r.bottom + 4 }, { kind: "message", id: message.id });
            }}
          >
            <MoreIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
});
