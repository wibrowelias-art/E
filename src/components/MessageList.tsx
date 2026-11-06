"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { fixtureMessages } from "@/data/fixture";
import { ALL_USERS } from "@/data/npcs";
import { dividerDate, GROUP_WINDOW_MS, startOfDay } from "@/lib/format";
import { mentionsUser, type MarkupContext } from "@/lib/markup";
import { useCurrentChannel, useCurrentGuild, useLounge } from "@/lib/store";
import type { Message } from "@/lib/types";
import { HashIcon } from "./icons";
import { MessageRow } from "./MessageRow";

type Row =
  | { kind: "start"; key: string }
  | { kind: "sep"; key: string; day: number }
  | { kind: "msg"; key: string; message: Message; groupStart: boolean };

function buildRows(messages: Message[]): Row[] {
  // The channel-start block is a row (not a Virtuoso Header) so it bottom-aligns with short histories.
  const rows: Row[] = [{ kind: "start", key: "start" }];
  let prev: Message | undefined;
  let prevDay = -1;
  for (const m of messages) {
    const day = startOfDay(m.createdAt);
    if (day !== prevDay) {
      rows.push({ kind: "sep", key: `sep-${day}`, day });
      prevDay = day;
      prev = undefined;
    }
    const groupStart =
      !prev || prev.authorId !== m.authorId || m.createdAt - prev.createdAt > GROUP_WINDOW_MS || !!m.replyToId;
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
  return (
    <div className="chan-start">
      <div className="chan-start__icon">
        <HashIcon size={42} strokeWidth={2.6} />
      </div>
      <h1 className="chan-start__title">Welcome to #{channel.name}!</h1>
      <p className="chan-start__sub">
        This is the start of the <b>#{channel.name}</b> channel. {channel.topic}
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

  const fixture = useLounge((s) => s.fixture);
  const messages = useMemo(
    () => (fixture ? fixtureMessages(channelId, now) : all.filter((m) => m.channelId === channelId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, channelId, fixture],
  );
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const rows = useMemo(() => buildRows(messages), [messages]);
  const viewer = users[viewerId];

  const markup: MarkupContext = useMemo(
    () => ({
      usersByName: new Map(ALL_USERS.map((u) => [u.displayName.toLowerCase(), u])),
      channelsByName: new Map(guild.channels.filter((c) => c.kind === "text").map((c) => [c.name, c])),
      onMention: (u) => openProfile(u.id, { x: window.innerWidth / 2 - 150, y: 120 }),
      onChannel: (c) => selectChannel(c.id),
    }),
    [guild, openProfile, selectChannel],
  );

  const ref = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
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
      let i = Math.min(startIndex, rows.length - 1);
      while (i > 0 && rows[i]?.kind !== "sep") i--;
      const r = rows[i];
      const first = rows[startIndex];
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
            <span>{dividerDate(stickyDay)}</span>
          </div>
        )}
      </div>
      <Virtuoso
        ref={ref}
        className="scroll-thin"
        style={{ flex: 1 }}
        data={rows}
        computeItemKey={(_, r) => r.key}
        initialTopMostItemIndex={rows.length - 1}
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
        itemContent={(index, r) => {
          if (r.kind === "start") return <ChannelStart />;
          if (r.kind === "sep") {
            return (
              <div className={`datesep ${index === 1 ? "datesep--first" : ""}`} role="separator">
                <span>{dividerDate(r.day)}</span>
              </div>
            );
          }
          const m = r.message;
          const author = users[m.authorId];
          if (!author) return <div style={{ height: 1 }} />;
          const parent = m.replyToId ? byId.get(m.replyToId) : undefined;
          const parentAuthor = parent ? users[parent.authorId] : undefined;
          return (
            <MessageRow
              message={m}
              author={author}
              groupStart={r.groupStart}
              replyTo={parent && parentAuthor ? { message: parent, author: parentAuthor } : null}
              now={now}
              viewerId={viewerId}
              mentioned={!!viewer && m.authorId !== viewerId && mentionsUser(m.content, viewer)}
              editing={editingId === m.id}
              replying={replyingToId === m.id}
              markup={markup}
              onReply={setReplyingTo}
              onEdit={startEdit}
              onSaveEdit={saveEdit}
              onReact={toggleReaction}
              onProfile={openProfile}
              onJumpTo={jumpTo}
            />
          );
        }}
      />
      {!atBottom && !pinned.current && (
        <button className="jump-bar" onClick={() => ref.current?.scrollToIndex({ index: "LAST", behavior: "smooth", align: "end" })}>
          <span>You&apos;re viewing older messages</span>
          <span>Jump to present ↓</span>
        </button>
      )}
    </div>
  );
}
