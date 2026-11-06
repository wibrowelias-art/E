"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCurrentChannel, useLounge } from "@/lib/store";
import {
  ArrowLeft,
  BellIcon,
  ChevronRight,
  EmojiFillIcon,
  EmojiIcon,
  GifIcon,
  SendIcon,
  HashIcon,
  LockIcon,
  MembersIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  StickerIcon,
  ThreadsIcon,
  CloseIcon,
} from "./icons";
import { MemberList } from "./MemberList";
import { MessageList } from "./MessageList";

export function typingLabel(names: string[]): { bold: string[]; rest: string } | null {
  if (!names.length) return null;
  if (names.length === 1) return { bold: [names[0]!], rest: " is typing…" };
  if (names.length === 2) return { bold: [names[0]!, names[1]!], rest: " are typing…" };
  if (names.length <= 4) return { bold: [names[0]!], rest: ` and ${names.length - 1} others are typing…` };
  return { bold: [], rest: "Several people are typing…" };
}

const NOBODY: string[] = [];

function Typing() {
  const channel = useCurrentChannel();
  const typing = useLounge((s) => s.typing[channel.id] ?? NOBODY);
  const users = useLounge((s) => s.users);
  const label = typingLabel(typing.map((id) => users[id]?.displayName ?? "Someone"));
  return (
    <div className="typing" aria-live="polite">
      {label && (
        <>
          <span className="typing__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="truncate">
            {label.bold.map((n, i) => (
              <span key={n}>
                {i > 0 && " and "}
                <b>{n}</b>
              </span>
            ))}
            {label.rest}
          </span>
        </>
      )}
    </div>
  );
}

function useComposer() {
  const channel = useCurrentChannel();
  const send = useLounge((s) => s.send);
  const startEdit = useLounge((s) => s.startEdit);
  const setReplyingTo = useLounge((s) => s.setReplyingTo);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const value = drafts[channel.id] ?? "";
  const setValue = (v: string) => setDrafts((d) => ({ ...d, [channel.id]: v }));

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (value.trim()) {
        send(channel.id, value);
        setValue("");
      }
    } else if (e.key === "ArrowUp" && !value) {
      // ↑ edits your own last message (human only)
      const s = useLounge.getState();
      const own = [...s.messages].reverse().find((m) => m.channelId === channel.id && m.authorId === s.viewerId);
      if (own) {
        e.preventDefault();
        startEdit(own.id);
      }
    } else if (e.key === "Escape" && useLounge.getState().replyingToId) {
      e.preventDefault();
      setReplyingTo(null);
    }
  };
  return { channel, value, setValue, onKeyDown };
}

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

function ReplyBanner() {
  const replyingToId = useLounge((s) => s.replyingToId);
  const msg = useLounge((s) => (replyingToId ? s.messages.find((m) => m.id === replyingToId) : undefined));
  const author = useLounge((s) => (msg ? s.users[msg.authorId] : undefined));
  const setReplyingTo = useLounge((s) => s.setReplyingTo);
  if (!msg || !author) return null;
  return (
    <div className="composer__reply">
      <span className="flex-1 truncate">
        Replying to <b>{author.displayName}</b>
      </span>
      <button className="iconbtn" style={{ width: 24, height: 24 }} onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

function DesktopComposer({ c }: { c: ReturnType<typeof useComposer> }) {
  const ref = useAutosize(c.value);
  const channelId = c.channel.id;
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, [channelId, ref]);
  return (
    <div className="composer">
      <ReplyBanner />
      <div className="composer__box">
        <button className="composer__attach" aria-label="Upload a file">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: "var(--icon-secondary)", color: "var(--bg-mod-subtle)" }}
          >
            <PlusIcon size={16} strokeWidth={3} />
          </span>
        </button>
        <textarea
          ref={ref}
          rows={1}
          className="composer__input scroll-thin"
          placeholder={`Message #${c.channel.name}`}
          aria-label={`Message #${c.channel.name}`}
          value={c.value}
          onChange={(e) => c.setValue(e.target.value)}
          onKeyDown={c.onKeyDown}
        />
        <div className="composer__tools">
          <button className="iconbtn" aria-label="Send a GIF">
            <GifIcon size={24} />
          </button>
          <button className="iconbtn" aria-label="Open sticker picker">
            <StickerIcon size={22} />
          </button>
          <button className="iconbtn" aria-label="Select emoji">
            <EmojiIcon size={22} />
          </button>
        </div>
      </div>
      <Typing />
    </div>
  );
}

function MobileComposer({ c }: { c: ReturnType<typeof useComposer> }) {
  const ref = useAutosize(c.value);
  const send = useLounge((s) => s.send);
  const canSend = !!c.value.trim();
  return (
    <div className="mcomposer">
      <div className="mcomposer__typing">
        <Typing />
      </div>
      <ReplyBanner />
      <div className="mcomposer__box">
        <button className="mcomposer__btn mcomposer__plus" aria-label="Upload a file">
          <PlusIcon size={25} strokeWidth={2} />
        </button>
        <textarea
          ref={ref}
          rows={1}
          className="mcomposer__input scroll-none"
          placeholder={`Message #${c.channel.name}`}
          aria-label={`Message #${c.channel.name}`}
          value={c.value}
          onChange={(e) => c.setValue(e.target.value)}
          onKeyDown={c.onKeyDown}
          enterKeyHint="send"
        />
        <button className="mcomposer__btn" aria-label="Send a GIF">
          <GifIcon size={24} />
        </button>
        <button className="mcomposer__btn" aria-label="Select emoji">
          <EmojiFillIcon size={24} />
        </button>
        <button
          className="mcomposer__btn mcomposer__send"
          data-ready={canSend}
          aria-label="Send"
          disabled={!canSend}
          onClick={() => {
            if (!canSend) return;
            send(c.channel.id, c.value);
            c.setValue("");
          }}
        >
          <SendIcon size={23} />
        </button>
      </div>
    </div>
  );
}

function DesktopHeader() {
  const channel = useCurrentChannel();
  const membersOpen = useLounge((s) => s.membersOpen);
  const toggleMembers = useLounge((s) => s.toggleMembers);
  const Icon = channel.staffOnly ? LockIcon : HashIcon;
  return (
    <header className="chat-head">
      <span style={{ color: "var(--icon-muted)" }} className="flex">
        <Icon size={24} />
      </span>
      <h2 className="chat-head__name">{channel.name}</h2>
      {channel.topic && (
        <>
          <span className="chat-head__sep" />
          <span className="chat-head__topic" title={channel.topic}>
            {channel.topic}
          </span>
        </>
      )}
      <div className="chat-head__tools">
        <button className="iconbtn" aria-label="Threads">
          <ThreadsIcon size={22} />
        </button>
        <button className="iconbtn" aria-label="Notification settings">
          <BellIcon size={22} />
        </button>
        <button className="iconbtn" aria-label="Pinned messages">
          <PinIcon size={22} />
        </button>
        <button
          className="iconbtn"
          data-active={membersOpen}
          aria-pressed={membersOpen}
          aria-label={membersOpen ? "Hide member list" : "Show member list"}
          onClick={() => toggleMembers()}
        >
          <MembersIcon size={22} />
        </button>
        <label className="chat-search">
          <input placeholder={`Search GOD // THE LOUNGE`} aria-label="Search" />
          <SearchIcon size={16} />
        </label>
      </div>
    </header>
  );
}

function MobileHeader() {
  const channel = useCurrentChannel();
  const setMobilePane = useLounge((s) => s.setMobilePane);
  const toggleMembers = useLounge((s) => s.toggleMembers);
  const readState = useLounge((s) => s.readState);
  const others = Object.entries(readState).reduce((n, [id, r]) => n + (id === channel.id ? 0 : r.mentions), 0);
  return (
    <header className="mchat-head">
      <button className="mchat-head__back" onClick={() => setMobilePane("channels")} aria-label="Back to channels">
        <ArrowLeft size={24} strokeWidth={2} />
        {others > 0 && <span className="mchat-head__badge">{others}</span>}
      </button>
      <button className="mchat-head__title" onClick={() => toggleMembers()} aria-label={`#${channel.name} — show members`}>
        <span className="mchat-head__hash">
          <HashIcon size={21} strokeWidth={2.6} />
        </span>
        <span className="mchat-head__name">{channel.name}</span>
        <span className="mchat-head__chev">
          <ChevronRight size={17} />
        </span>
      </button>
      <button className="mchat-head__search" aria-label="Search">
        <SearchIcon size={21} />
      </button>
    </header>
  );
}

export function Chat() {
  const composer = useComposer();
  return (
    <main className="chat" aria-label={`#${composer.channel.name}`}>
      <DesktopHeader />
      <MobileHeader />
      <div className="chat-body">
        <div className="chat-main">
          <MessageList />
          <DesktopComposer c={composer} />
          <MobileComposer c={composer} />
        </div>
        <MemberList />
      </div>
    </main>
  );
}

