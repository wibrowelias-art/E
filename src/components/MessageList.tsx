"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { fixtureMessages } from "@/data/fixture";
import { ALL_USERS } from "@/data/npcs";
import { clock, dividerDate, GROUP_WINDOW_MS, startOfDay } from "@/lib/format";
import { mentionsUser, type MarkupContext } from "@/lib/markup";
import { messageText, useCurrentChannel, useCurrentGuild, useLounge, useT } from "@/lib/store";
import type { Message } from "@/lib/types";
import { ArrowDownIcon, CheckAllIcon, HashIcon } from "./icons";
import { MessageRow } from "./MessageRow";

type Row =
  | { kind: "start"; key: string }
  | { kind: "loader"; key: string }
  | { kind: "sep"; key: string; day: number }
  | { kind: "new"; key: string }
  | { kind: "msg"; key: string; message: Message; groupStart: boolean };

function buildRows(messages: Message[], atStart: boolean, dividerAt: number | null, viewerId: string): Row[] {
  // The channel-start block is a row (not a Virtuoso Header) so it bottom-aligns with short histories.
  // While older history exists on the server, a loader row sits there instead.
  const rows: Row[] = [atStart ? { kind: "start", key: "start" } : { kind: "loader", key: "loader" }];
  let prev: Message | undefined;
  let prevDay = -1;
  let dividerPlaced = dividerAt == null;
  for (const m of messages) {
    const day = startOfDay(m.createdAt);
    if (day !== prevDay) {
      rows.push({ kind: "sep", key: `sep-${day}`, day });
      prevDay = day;
      prev = undefined;
    }
    let forceGroup = false;
    if (!dividerPlaced && m.createdAt > dividerAt! && m.authorId !== viewerId) {
      rows.push({ kind: "new", key: "new-divider" });
      dividerPlaced = true;
      forceGroup = true;
    }
    const groupStart =
      forceGroup || !prev || prev.authorId !== m.authorId || m.createdAt - prev.createdAt > GROUP_WINDOW_MS || !!m.replyToId;
    rows.push({ kind: "msg", key: m.id, message: m, groupStart });
    prev = m;
  }
  return rows;
}

export function MessageListSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-5 overflow-hidden px-4 pb-6" aria-busy="true" aria-label="Loading messages">
      {[0.55, 0.8, 0.35, 0.7, 0.5, 0.9, 0.45].map((w, i) => (
        <div key={i} className="flex gap-4">
          <div className="skel h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="skel h-3.5 w-32" />
            <div className="skel h-3.5" style={{ width: `${w * 100}%` }} />
            {i % 3 === 1 && <div className="skel h-3.5" style={{ width: `${w * 60}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListFooter() {
  return <div className="msglist-footer" />;
}

function ChannelStart() {
  const channel = useCurrentChannel();
  const t = useT();
  const start = t.startOf(channel.name);
  return (
    <div className="chan-start">
      <div className="chan-start__icon">
        <HashIcon size={42} strokeWidth={2.6} />
      </div>
      <h1 className="chan-start__title">{t.welcome(channel.name)}</h1>
      <p className="chan-start__sub">
        {start[0]}
        <b>{start[1]}</b>
        {start[2]} {channel.topic}
      </p>
    </div>
  );
}

export function MessageList() {
  const ready = useLounge((s) => s.ready);
  const channel = useCurrentChannel();
  if (!ready) return <MessageListSkeleton />;
  return <MessageListInner key={channel.id} channelId={channel.id} />;
}

function MessageListInner({ channelId }: { channelId: string }) {
  const guild = useCurrentGuild();
  const all = useLounge((s) => s.messages);
  const users = useLounge((s) => s.users);
  const viewerId = useLounge((s) => s.viewerId);
  const now = useLounge((s) => s.now);
  const editingId = useLounge((s) => s.editingId);
  const replyingToId = useLounge((s) => s.replyingToId);
  const setReplyingTo = useLounge((s) => s.setReplyingTo);
  const startEdit = useLounge((s) => s.startEdit);
  const saveEdit = useLounge((s) => s.saveEdit);
  const toggleReaction = useLounge((s) => s.toggleReaction);
  const openProfile = useLounge((s) => s.openProfile);
  const selectChannel = useLounge((s) => s.selectChannel);
  const lang = useLounge((s) => s.lang);
  const t = useT();

  const fixture = useLounge((s) => s.fixture);
  const messages = useMemo(
    () => (fixture ? fixtureMessages(channelId, now) : all.filter((m) => m.channelId === channelId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, channelId, fixture],
  );
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const hist = useLounge((s) => s.history[channelId]);
  const loadOlder = useLounge((s) => s.loadOlder);
  const retrySend = useLounge((s) => s.retrySend);
  const discardFailed = useLounge((s) => s.discardFailed);
  const atStart = fixture || !hist?.hasMore;
  const dividerAt = useLounge((s) => s.dividerAt[channelId] ?? null);
  const markRead = useLounge((s) => s.markRead);
  const seeCurrent = useLounge((s) => s.seeCurrent);
  const rows = useMemo(() => buildRows(messages, atStart, dividerAt, viewerId), [messages, atStart, dividerAt, viewerId]);
  const newCount = useMemo(
    () => (dividerAt == null ? 0 : messages.filter((m) => m.createdAt > dividerAt && m.authorId !== viewerId).length),
    [messages, dividerAt, viewerId],
  );
  const firstSepKey = atStart ? rows.find((r) => r.kind === "sep")?.key : undefined;

  // Prepending older history: shift firstItemIndex by the rows inserted above the old first message.
  const firstIndex = useRef(1_000_000);
  const prevFirst = useRef<{ key: string; pos: number } | null>(null);
  useMemo(() => {
    const pos = rows.findIndex((r) => r.kind === "msg");
    const prev = prevFirst.current;
    if (prev) {
      const now = rows.findIndex((r) => r.key === prev.key);
      if (now > prev.pos) firstIndex.current -= now - prev.pos;
    }
    prevFirst.current = pos >= 0 ? { key: rows[pos]!.key, pos } : null;
  }, [rows]);
  const viewer = users[viewerId];

  const markup: MarkupContext = useMemo(
    () => ({
      usersByName: new Map(ALL_USERS.map((u) => [u.displayName.toLowerCase(), u])),
      channelsByName: new Map(guild.channels.filter((c) => c.kind === "text").map((c) => [c.name, c])),
      onMention: (u, el) => {
        const r = el.getBoundingClientRect();
        openProfile(u.id, { x: r.left, y: r.bottom + 6 });
      },
      onChannel: (c) => selectChannel(c.id),
    }),
    [guild, openProfile, selectChannel],
  );

  const ref = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Reading at the bottom of a visible channel keeps it read.
  useEffect(() => {
    if (atBottom && !document.hidden) seeCurrent();
  }, [atBottom, messages.length, seeCurrent]);
  // Pinned to the bottom until the human scrolls (rows re-measure after fonts/emoji load).
  const pinned = useRef(true);
  const userScrolled = () => {
    pinned.current = false;
  };
  const scroller = useRef<HTMLElement | null>(null);
  const repin = useCallback(() => {
    const el = scroller.current;
    if (pinned.current && el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    repin();
    const timers = [60, 200, 600].map((ms) => setTimeout(repin, ms));
    document.fonts?.ready.then(repin);
    // Any size change of the scroll content while pinned → stay at the bottom.
    const el = scroller.current;
    const ro = new ResizeObserver(() => repin());
    if (el) {
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
    };
  }, [repin]);
  const [stickyDay, setStickyDay] = useState<number | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Own message → always jump to the bottom (Discord behaviour).
  const lastMsg = messages[messages.length - 1];
  useEffect(() => {
    if (lastMsg?.authorId === viewerId && lastMsg.id.startsWith("m_local_")) {
      requestAnimationFrame(() => ref.current?.scrollToIndex({ index: "LAST", behavior: "smooth", align: "end" }));
    }
  }, [lastMsg, viewerId]);

  const onRange = useCallback(
    ({ startIndex }: { startIndex: number }) => {
      const local = startIndex >= firstIndex.current ? startIndex - firstIndex.current : startIndex;
      let i = Math.max(0, Math.min(local, rows.length - 1));
      while (i > 0 && rows[i]?.kind !== "sep") i--;
      const r = rows[i];
      const first = rows[Math.max(0, Math.min(local, rows.length - 1))];
      // Hide the floating pill when the real divider itself is at the top.
      if (!pinned.current && r?.kind === "sep" && first?.kind !== "sep") {
        setStickyDay(r.day);
        setShowSticky(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowSticky(false), 1400);
      } else setShowSticky(false);
    },
    [rows],
  );

  const jumpTo = useCallback(
    (id: string) => {
      const index = rows.findIndex((r) => r.kind === "msg" && r.message.id === id);
      if (index >= 0) ref.current?.scrollToIndex({ index, align: "center", behavior: "smooth" });
    },
    [rows],
  );

  return (
    <div
      className="msglist relative flex flex-col"
      onWheel={(e) => e.deltaY < 0 && userScrolled()}
      onTouchMove={userScrolled}
      onKeyDown={(e) => ["ArrowUp", "PageUp", "Home"].includes(e.key) && userScrolled()}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-2 z-[2] flex justify-center transition-opacity duration-200"
        style={{ opacity: showSticky && stickyDay ? 1 : 0 }}
        aria-hidden
      >
        {stickyDay && (
          <div className="datesep datesep--sticky">
            <span>{dividerDate(stickyDay, lang)}</span>
          </div>
        )}
      </div>
      <Virtuoso
        ref={ref}
        className="scroll-thin"
        style={{ flex: 1 }}
        data={rows}
        computeItemKey={(_, r) => r.key}
        firstItemIndex={firstIndex.current}
        initialTopMostItemIndex={rows.length - 1}
        startReached={() => void loadOlder(channelId)}
        alignToBottom
        followOutput={(bottom) => (bottom ? "smooth" : false)}
        atBottomStateChange={(b) => {
          setAtBottom(b);
          if (b) pinned.current = true;
        }}
        totalListHeightChanged={() => requestAnimationFrame(repin)}
        scrollerRef={(el) => {
          scroller.current = el instanceof HTMLElement ? el : null;
        }}
        atBottomThreshold={120}
        increaseViewportBy={{ top: 600, bottom: 300 }}
        rangeChanged={onRange}
        components={{ Footer: ListFooter }}
        itemContent={(_, r) => {
          if (r.kind === "start") return <ChannelStart />;
          if (r.kind === "loader") {
            return (
              <div className="history-loader" aria-live="polite">
                {hist?.loading ? t.loadingOlder : ""}
              </div>
            );
          }
          if (r.kind === "new") {
            return (
              <div className="newsep" role="separator" aria-label={t.newLabel}>
                <span>{t.newLabel}</span>
              </div>
            );
          }
          if (r.kind === "sep") {
            return (
              <div className={`datesep ${r.key === firstSepKey ? "datesep--first" : ""}`} role="separator">
                <span>{dividerDate(r.day, lang)}</span>
              </div>
            );
          }
          const m = r.message;
          const author = users[m.authorId];
          if (!author) return <div style={{ height: 1 }} />;
          const parent = m.replyToId ? byId.get(m.replyToId) : undefined;
          const parentAuthor = parent ? users[parent.authorId] : undefined;
          const text = messageText(m, lang);
          return (
            <MessageRow
              message={m}
              author={author}
              groupStart={r.groupStart}
              replyTo={parent && parentAuthor ? { message: parent, author: parentAuthor } : null}
              now={now}
              lang={lang}
              t={t}
              text={text}
              replyText={parent ? messageText(parent, lang) : undefined}
              viewerId={viewerId}
              mentioned={!!viewer && m.authorId !== viewerId && mentionsUser(text, viewer)}
              editing={editingId === m.id}
              replying={replyingToId === m.id}
              markup={markup}
              onReply={setReplyingTo}
              onEdit={startEdit}
              onSaveEdit={saveEdit}
              onReact={toggleReaction}
              onProfile={openProfile}
              onJumpTo={jumpTo}
              onRetry={retrySend}
              onDiscard={discardFailed}
            />
          );
        }}
      />
      {dividerAt != null && newCount > 0 && (
        <div className="newbar" role="status">
          <button
            className="newbar__text"
            onClick={() => {
              const index = rows.findIndex((r) => r.kind === "new");
              if (index >= 0) ref.current?.scrollToIndex({ index, align: "center", behavior: "smooth" });
            }}
          >
            {t.newSince(newCount, clock(dividerAt, lang))}
          </button>
          <button className="newbar__btn" onClick={() => markRead(channelId)}>
            {t.markAsRead} <CheckAllIcon size={15} />
          </button>
        </div>
      )}
      {!atBottom && !pinned.current && (
        <button className="jump-bar" onClick={() => ref.current?.scrollToIndex({ index: "LAST", behavior: "smooth", align: "end" })}>
          <span>{t.olderMessages}</span>
          <span className="flex items-center gap-1">
            {t.jumpToPresent} <ArrowDownIcon size={15} />
          </span>
        </button>
      )}
    </div>
  );
}
