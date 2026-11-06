import type { ReactNode } from "react";
import type { Channel, User } from "./types";

const TOKEN =
  /(\*\*[^*\n]+\*\*)|(\*[^*\s\n][^*\n]*\*)|(`[^`\n]+`)|(@[\p{L}\p{N}_.]+)|(#[a-z0-9-]+)|(https?:\/\/[^\s<]+)/gu;

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
const HAS_PICTO = /\p{Extended_Pictographic}/u;

export function isJumboEmoji(text: string): boolean {
  const t = text.trim();
  if (!t || !EMOJI_ONLY.test(t) || !HAS_PICTO.test(t)) return false;
  // Count graphemes, Discord makes up to 27 emoji jumbo.
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : null;
  const count = seg ? [...seg.segment(t.replace(/\s+/g, ""))].length : t.length / 2;
  return count <= 27;
}

export interface MarkupContext {
  usersByName: Map<string, User>;
  channelsByName: Map<string, Channel>;
  onMention?: (user: User) => void;
  onChannel?: (channel: Channel) => void;
}

export function mentionsUser(text: string, user: User): boolean {
  return new RegExp(`@${user.displayName}\\b`, "i").test(text);
}

export function renderMarkup(text: string, ctx: MarkupContext): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const [tok] = m;
    const key = `t${i++}`;
    if (m[1]) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (m[2]) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (m[3]) out.push(<code key={key} className="md-code">{tok.slice(1, -1)}</code>);
    else if (m[4]) {
      const user = ctx.usersByName.get(tok.slice(1).toLowerCase());
      if (user) {
        out.push(
          <span key={key} className="mention" role="button" tabIndex={0} onClick={() => ctx.onMention?.(user)}>
            @{user.displayName}
          </span>,
        );
      } else out.push(tok);
    } else if (m[5]) {
      const ch = ctx.channelsByName.get(tok.slice(1));
      if (ch) {
        out.push(
          <span key={key} className="mention" role="link" tabIndex={0} onClick={() => ctx.onChannel?.(ch)}>
            #{ch.name}
          </span>,
        );
      } else out.push(tok);
    } else if (m[6]) {
      out.push(
        <a key={key} className="md-link" href={tok} target="_blank" rel="noreferrer noopener">
          {tok}
        </a>,
      );
    }
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Plain-text preview for reply bars (strips markdown markers). */
export function plainPreview(text: string): string {
  return text.replace(/\*\*|`/g, "").replace(/\n+/g, " ");
}
