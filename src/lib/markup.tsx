"use client";

import { useState, type ReactNode } from "react";
import type { Channel, User } from "./types";

/*
 * Chat markdown: blocks (``` code ```, > quotes, # headings, - / 1. lists) and inline
 * (**bold**, *italic* / _italic_, __underline__, ~~strike~~, `code`, ||spoiler||,
 * @mentions, #channels, links). Nested inline styles render recursively.
 */

const INLINE =
  /(`[^`\n]+`)|(\|\|[\s\S]+?\|\|)|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(~~[\s\S]+?~~)|(\*[^*\s][^*\n]*?\*)|(\b_[^_\s][^_\n]*?_\b)|(@[\p{L}\p{N}_.]+)|(#[a-z0-9-]+)|(<?https?:\/\/[^\s<>]+[^\s<>.,:;"')\]!?]>?)/gu;

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
const HAS_PICTO = /\p{Extended_Pictographic}/u;
export const URL_RE = /https?:\/\/[^\s<>]+[^\s<>.,:;"')\]!?]/g;

export function isJumboEmoji(text: string): boolean {
  const t = text.trim();
  if (!t || !EMOJI_ONLY.test(t) || !HAS_PICTO.test(t)) return false;
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : null;
  const count = seg ? [...seg.segment(t.replace(/\s+/g, ""))].length : t.length / 2;
  return count <= 27;
}

export interface MarkupContext {
  usersByName: Map<string, User>;
  channelsByName: Map<string, Channel>;
  onMention?: (user: User, el: HTMLElement) => void;
  onChannel?: (channel: Channel) => void;
}

export function mentionsUser(text: string, user: User): boolean {
  return new RegExp(`@${user.displayName}\\b`, "i").test(text);
}

/** First http(s) link outside code, for the link preview. */
export function firstLink(text: string): string | null {
  const stripped = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "").replace(/<https?:\/\/[^>]+>/g, "");
  return stripped.match(URL_RE)?.[0] ?? null;
}

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="md-spoiler"
      data-open={open}
      role="button"
      tabIndex={0}
      aria-label={open ? undefined : "Spoiler, click to reveal"}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
    >
      <span className="md-spoiler__inner">{children}</span>
    </span>
  );
}

function inline(text: string, ctx: MarkupContext, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const [tok] = m;
    const key = `${keyBase}.${i++}`;
    if (m[1]) out.push(<code key={key} className="md-code">{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<Spoiler key={key}>{inline(tok.slice(2, -2), ctx, key)}</Spoiler>);
    else if (m[3]) out.push(<strong key={key}>{inline(tok.slice(2, -2), ctx, key)}</strong>);
    else if (m[4]) out.push(<u key={key}>{inline(tok.slice(2, -2), ctx, key)}</u>);
    else if (m[5]) out.push(<s key={key}>{inline(tok.slice(2, -2), ctx, key)}</s>);
    else if (m[6] || m[7]) out.push(<em key={key}>{inline(tok.slice(1, -1), ctx, key)}</em>);
    else if (m[8]) {
      const user = ctx.usersByName.get(tok.slice(1).toLowerCase());
      if (user) {
        out.push(
          <span key={key} className="mention" role="button" tabIndex={0} onClick={(e) => ctx.onMention?.(user, e.currentTarget)}>
            @{user.displayName}
          </span>,
        );
      } else out.push(tok);
    } else if (m[9]) {
      const ch = ctx.channelsByName.get(tok.slice(1));
      if (ch) {
        out.push(
          <span key={key} className="mention mention--channel" role="link" tabIndex={0} onClick={() => ctx.onChannel?.(ch)}>
            #{ch.name}
          </span>,
        );
      } else out.push(tok);
    } else if (m[10]) {
      const href = tok.replace(/^<|>$/g, "");
      out.push(
        <a key={key} className="md-link" href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
          {href}
        </a>,
      );
    }
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Render a message body. Returns block-level nodes (paragraph text stays pre-wrap). */
export function renderMarkup(text: string, ctx: MarkupContext): ReactNode[] {
  const out: ReactNode[] = [];
  // 1) split out fenced code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  const isFence = (x?: string) => !!x && x.startsWith("```") && x.endsWith("```") && x.length >= 6;
  parts.forEach((raw, pi) => {
    let part = raw;
    if (!isFence(part)) {
      if (isFence(parts[pi - 1])) part = part.replace(/^\n/, "");
      if (isFence(parts[pi + 1])) part = part.replace(/\n$/, "");
    }
    if (!part) return;
    if (isFence(part)) {
      const body = part.slice(3, -3);
      const nl = body.indexOf("\n");
      const lang = nl > 0 && /^[a-z0-9+#-]{1,15}$/i.test(body.slice(0, nl).trim()) ? body.slice(0, nl).trim() : "";
      const code = (lang ? body.slice(nl + 1) : body).replace(/^\n|\n$/g, "");
      out.push(
        <pre key={`b${pi}`} className="md-pre" data-lang={lang || undefined}>
          {lang && <span className="md-pre__lang">{lang}</span>}
          <code>{code}</code>
        </pre>,
      );
      return;
    }
    // 2) line blocks: quotes, headings, lists; everything else stays inline text
    const lines = part.split("\n");
    let buf: string[] = [];
    let quote: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let n = 0;
    const flushText = () => {
      if (!buf.length) return;
      const t = buf.join("\n");
      buf = [];
      if (t) out.push(<span key={`p${pi}.${n++}`}>{inline(t, ctx, `p${pi}.${n}`)}</span>);
    };
    const flushQuote = () => {
      if (!quote.length) return;
      out.push(
        <blockquote key={`q${pi}.${n++}`} className="md-quote">
          {inline(quote.join("\n"), ctx, `q${pi}.${n}`)}
        </blockquote>,
      );
      quote = [];
    };
    const flushList = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      out.push(
        <Tag key={`l${pi}.${n++}`} className="md-list">
          {list.items.map((it, k) => (
            <li key={k}>{inline(it, ctx, `l${pi}.${n}.${k}`)}</li>
          ))}
        </Tag>,
      );
      list = null;
    };
    lines.forEach((line, li) => {
      const q = line.match(/^>\s?(.*)$/);
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      const ul = line.match(/^\s*[-*]\s+(.+)$/);
      const ol = line.match(/^\s*\d{1,3}[.)]\s+(.+)$/);
      if (q) {
        flushText();
        flushList();
        quote.push(q[1]!);
      } else if (h) {
        flushText();
        flushQuote();
        flushList();
        const level = h[1]!.length;
        out.push(
          <div key={`h${pi}.${n++}`} className={`md-h md-h${level}`} role="heading" aria-level={level + 1}>
            {inline(h[2]!, ctx, `h${pi}.${n}`)}
          </div>,
        );
      } else if (ul || ol) {
        flushText();
        flushQuote();
        const ordered = !!ol;
        if (list && list.ordered !== ordered) flushList();
        list ??= { ordered, items: [] };
        list.items.push((ul ?? ol)![1]!);
      } else {
        flushQuote();
        flushList();
        buf.push(line);
        if (li === lines.length - 1) flushText();
      }
    });
    flushText();
    flushQuote();
    flushList();
  });
  return out;
}

/** Plain-text preview for reply bars and notifications (strips markdown markers). */
export function plainPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\|\|[\s\S]+?\|\|/g, "▒▒▒▒")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\n+/g, " ");
}
