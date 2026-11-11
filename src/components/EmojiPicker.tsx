"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Apple, Clock, Flag, Heart, Lightbulb, PawPrint, Plane, Smile, Trophy, Users } from "lucide-react";
import { useLounge, useT } from "@/lib/store";
import { placeInViewport, useUi } from "@/lib/ui";

interface Emoji {
  e: string;
  n: string;
}
interface Group {
  slug: string;
  name: string;
  emojis: Emoji[];
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  recent: Clock,
  smileys_emotion: Smile,
  people_body: Users,
  animals_nature: PawPrint,
  food_drink: Apple,
  travel_places: Plane,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Heart,
  flags: Flag,
};
const RECENT_KEY = "lounge.recentEmoji";
const DEFAULT_RECENT = ["🔥", "😭", "🖤", "💀", "😂", "👀", "🙏", "✨", "🫶", "🍸", "📸", "🎧"];

let cache: Promise<Group[]> | null = null;
function loadGroups(): Promise<Group[]> {
  cache ??= import("unicode-emoji-json/data-by-group.json").then((mod) => {
    const raw = (mod as unknown as { default: Array<{ name: string; slug: string; emojis: Array<{ emoji: string; name: string; emoji_version: string }> }> }).default;
    // Skip the newest emoji: older phones render them as boxes.
    return raw.map((g) => ({
      slug: g.slug,
      name: g.name,
      emojis: g.emojis.filter((x) => parseFloat(x.emoji_version) <= 14).map((x) => ({ e: x.emoji, n: x.name })),
    }));
  });
  return cache;
}

export function rememberEmoji(e: string) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...list.filter((x) => x !== e)].slice(0, 24)));
  } catch {
    /* private mode */
  }
}

function recentEmoji(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    return list.length ? list : DEFAULT_RECENT;
  } catch {
    return DEFAULT_RECENT;
  }
}

const W = 360;
const H = 420;

export function EmojiPicker() {
  const picker = useUi((s) => s.picker);
  const close = () => useUi.setState({ picker: null });
  const toggleReaction = useLounge((s) => s.toggleReaction);
  const insertText = useUi((s) => s.insertText);
  const t = useT();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<Emoji | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picker) return;
    setQ("");
    setRecent(recentEmoji());
    void loadGroups().then(setGroups);
    if (window.innerWidth >= 768) requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  }, [picker]);

  const results = useMemo(() => {
    if (!groups || !q.trim()) return null;
    const needle = q.trim().toLowerCase();
    return groups.flatMap((g) => g.emojis).filter((x) => x.n.includes(needle)).slice(0, 160);
  }, [groups, q]);

  if (!picker) return null;
  const mobile = window.innerWidth < 768;
  const pos = mobile ? null : placeInViewport(picker.x - W, picker.y - H - 8, W, H);

  const pick = (e: string) => {
    rememberEmoji(e);
    if (picker.target.kind === "react") {
      toggleReaction(picker.target.messageId, e);
      close();
    } else {
      insertText(e);
      if (!mobile) close();
    }
  };

  const cell = (x: Emoji, key: string) => (
    <button key={key} className="ep__cell" onClick={() => pick(x.e)} onMouseEnter={() => setHover(x)} aria-label={x.n}>
      {x.e}
    </button>
  );

  return (
    <>
      <div className="ep-backdrop" onClick={close} data-mobile={mobile} />
      <div
        className="ep"
        data-mobile={mobile}
        style={pos ? { left: pos.left, top: pos.top, width: W, height: H } : undefined}
        role="dialog"
        aria-label={t.emojiPicker}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <div className="ep__search">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.findEmoji}
            aria-label={t.findEmoji}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results?.[0]) pick(results[0].e);
            }}
          />
        </div>
        <div className="ep__body">
          <nav className="ep__tabs" aria-label="Emoji categories">
            {["recent", ...(groups ?? []).map((g) => g.slug)].map((slug) => {
              const Icon = ICONS[slug] ?? Smile;
              return (
                <button
                  key={slug}
                  className="ep__tab"
                  title={slug === "recent" ? t.recentEmoji : groups?.find((g) => g.slug === slug)?.name}
                  onClick={() => {
                    setQ("");
                    requestAnimationFrame(() => gridRef.current?.querySelector(`[data-group="${slug}"]`)?.scrollIntoView({ block: "start" }));
                  }}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </nav>
          <div className="ep__grid scroll-thin" ref={gridRef}>
            {results ? (
              results.length ? (
                <div className="ep__cells">{results.map((x, i) => cell(x, `r${i}`))}</div>
              ) : (
                <div className="ep__empty">{t.noEmoji}</div>
              )
            ) : (
              <>
                <div className="ep__group" data-group="recent">
                  {t.recentEmoji}
                </div>
                <div className="ep__cells">{recent.map((e, i) => cell({ e, n: e }, `rc${i}`))}</div>
                {!groups && <div className="ep__empty">…</div>}
                {groups?.map((g) => (
                  <div key={g.slug}>
                    <div className="ep__group" data-group={g.slug}>
                      {g.name}
                    </div>
                    <div className="ep__cells">{g.emojis.map((x) => cell(x, x.e))}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="ep__footer">
          {hover ? (
            <>
              <span className="ep__footer-emoji">{hover.e}</span>
              <span className="truncate">{hover.n === hover.e ? "" : `:${hover.n.replace(/\s+/g, "_")}:`}</span>
            </>
          ) : (
            <span className="ep__footer-hint">{t.emojiHint}</span>
          )}
        </div>
      </div>
    </>
  );
}
