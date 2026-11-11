"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Attachment } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { prepareImage, UploadError, uploadImage } from "@/lib/upload";
import { useCurrentChannel, useCurrentGuild, useLounge, useT } from "@/lib/store";
import type { Strings } from "@/lib/i18n";
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
  SlidersIcon,
  StickerIcon,
  ThreadsIcon,
  CloseIcon,
} from "./icons";
import { MemberList } from "./MemberList";
import { MessageList } from "./MessageList";

export function typingLabel(names: string[], t: Strings): { bold: string[]; rest: string } | null {
  if (!names.length) return null;
  if (names.length === 1) return { bold: [names[0]!], rest: t.typing1 };
  if (names.length === 2) return { bold: [names[0]!, names[1]!], rest: t.typing2 };
  if (names.length <= 4) return { bold: [names[0]!], rest: t.typingN(names.length - 1) };
  return { bold: [], rest: t.typingMany };
}

const NOBODY: string[] = [];

function Typing() {
  const channel = useCurrentChannel();
  const typing = useLounge((s) => s.typing[channel.id] ?? NOBODY);
  const users = useLounge((s) => s.users);
  const t = useT();
  const label = typingLabel(typing.map((id) => users[id]?.displayName ?? "Someone"), t);
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
                {i > 0 && t.and}
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

interface Pending {
  key: string;
  preview: string;
  filename: string;
  attachment?: Attachment;
  error?: boolean;
}

let pendingSeq = 0;

function useComposer() {
  const channel = useCurrentChannel();
  const send = useLounge((s) => s.send);
  const startEdit = useLounge((s) => s.startEdit);
  const setReplyingTo = useLounge((s) => s.setReplyingTo);
  const persistence = useLounge((s) => s.persistence);
  const showToast = useLounge((s) => s.showToast);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, Pending[]>>({});
  const value = drafts[channel.id] ?? "";
  const pending = files[channel.id] ?? [];
  const setValue = (v: string) => setDrafts((d) => ({ ...d, [channel.id]: v }));
  const inputs = useRef<Set<HTMLTextAreaElement>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const t = useT();

  const activeInput = () => [...inputs.current].find((el) => el.offsetParent !== null) ?? null;

  // Emoji picker / "Mention" insert text at the caret.
  const insert = useUi((s) => s.insert);
  const lastInsert = useRef(0);
  useEffect(() => {
    if (!insert || insert.seq === lastInsert.current) return;
    lastInsert.current = insert.seq;
    const el = activeInput();
    const cur = useLounge.getState().channelByGuild[useLounge.getState().guildId]!;
    setDrafts((d) => {
      const v = d[cur] ?? "";
      const at = el && document.activeElement === el ? el.selectionStart : v.length;
      const next = v.slice(0, at) + insert.text + v.slice(at);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(at + insert.text.length, at + insert.text.length);
      });
      return { ...d, [cur]: next };
    });
  }, [insert]);

  const addFiles = (list: FileList | File[]) => {
    const channelId = channel.id;
    for (const file of Array.from(list).slice(0, 4)) {
      if (!file.type.startsWith("image/")) {
        showToast(t.uploadType);
        continue;
      }
      const key = `p${++pendingSeq}`;
      const update = (fn: (p: Pending) => Pending) =>
        setFiles((f) => ({ ...f, [channelId]: (f[channelId] ?? []).map((x) => (x.key === key ? fn(x) : x)) }));
      setFiles((f) => ({ ...f, [channelId]: [...(f[channelId] ?? []), { key, preview: "", filename: file.name }].slice(-4) }));
      void prepareImage(file)
        .then(async (prep) => {
          update((x) => ({ ...x, preview: prep.preview, filename: prep.filename }));
          const attachment = await uploadImage(prep, persistence);
          update((x) => ({ ...x, attachment }));
        })
        .catch((e: unknown) => {
          showToast(e instanceof UploadError ? (e.message === "size" ? t.uploadTooBig : t.uploadType) : e instanceof Error ? e.message : t.failed);
          setFiles((f) => ({ ...f, [channelId]: (f[channelId] ?? []).filter((x) => x.key !== key) }));
        });
    }
  };
  const removeFile = (key: string) => setFiles((f) => ({ ...f, [channel.id]: (f[channel.id] ?? []).filter((x) => x.key !== key) }));
  const uploading = pending.some((p) => !p.attachment);
  const canSend = (!!value.trim() || pending.length > 0) && !uploading;

  const submit = () => {
    if (!canSend) return;
    send(channel.id, value, pending.map((p) => p.attachment!).filter(Boolean));
    setValue("");
    setFiles((f) => ({ ...f, [channel.id]: [] }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp" && !value && !e.altKey) {
      // ↑ edits your own last message
      const s = useLounge.getState();
      const own = [...s.messages].reverse().find((m) => m.channelId === channel.id && m.authorId === s.viewerId && !m.pending && !m.failed);
      if (own) {
        e.preventDefault();
        startEdit(own.id);
      }
    } else if (e.key === "Escape" && useLounge.getState().replyingToId) {
      e.preventDefault();
      e.stopPropagation();
      setReplyingTo(null);
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (imgs.length) {
      e.preventDefault();
      addFiles(imgs);
    }
  };
  const canPost = useLounge((st) => st.ready && st.canPost(channel.id));
  const role = useLounge((st) => st.role);
  const readOnlyText = role === "tourist" ? t.guestReadOnly(channel.name) : t.readOnly(channel.name);
  const register = (el: HTMLTextAreaElement | null) => {
    if (el) inputs.current.add(el);
  };
  const openFiles = (gif = false) => {
    const el = fileInput.current;
    if (!el) return;
    el.accept = gif ? "image/gif" : "image/png,image/jpeg,image/webp,image/gif";
    el.click();
  };
  const emojiAt = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    useUi.getState().openPicker({ x: r.right, y: r.top }, { kind: "composer" });
  };
  const fileField = (
    <input
      ref={fileInput}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files?.length) addFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );
  return { channel, value, setValue, onKeyDown, onPaste, t, canPost, readOnlyText, pending, removeFile, addFiles, canSend, submit, register, openFiles, emojiAt, fileField, uploading };
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
  const t = useT();
  if (!msg || !author) return null;
  return (
    <div className="composer__reply">
      <span className="flex-1 truncate">
        {t.replyingTo} <b>{author.displayName}</b>
      </span>
      <button className="iconbtn" style={{ width: 24, height: 24 }} onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

function Tray({ c }: { c: ReturnType<typeof useComposer> }) {
  if (!c.pending.length) return null;
  return (
    <div className="tray" aria-label="Attachments">
      {c.pending.map((p) => (
        <div key={p.key} className="tray__item" data-loading={!p.attachment || undefined}>
          {p.preview ? <img src={p.preview} alt={p.filename} /> : <span className="tray__ph" />}
          <span className="tray__name">{p.attachment ? p.filename : c.t.uploading}</span>
          <button className="tray__x" onClick={() => c.removeFile(p.key)} aria-label={`Remove ${p.filename}`}>
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Drag an image anywhere over the chat to attach it. */
function useDropZone(c: ReturnType<typeof useComposer>) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const props = {
    onDragEnter: (e: DragEvent) => {
      if (!c.canPost || ![...e.dataTransfer.types].includes("Files")) return;
      depth.current++;
      setOver(true);
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    },
    onDragOver: (e: DragEvent) => {
      if (c.canPost && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      depth.current = 0;
      setOver(false);
      if (!c.canPost || !e.dataTransfer.files.length) return;
      e.preventDefault();
      c.addFiles(e.dataTransfer.files);
    },
  };
  return { over, props };
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
      {!c.canPost ? (
        <div className="composer__readonly" role="note">
          {c.readOnlyText}
        </div>
      ) : (
        <div className="composer__box" data-attached={c.pending.length > 0 || undefined}>
          <Tray c={c} />
          <div className="composer__row">
            <button className="composer__attach" aria-label={c.t.upload} title={c.t.upload} onClick={() => c.openFiles()}>
              <span className="composer__plus">
                <PlusIcon size={16} strokeWidth={2.6} />
              </span>
            </button>
            <textarea
              ref={(el) => {
                (ref as { current: HTMLTextAreaElement | null }).current = el;
                c.register(el);
              }}
              rows={1}
              className="composer__input scroll-thin"
              placeholder={c.t.messagePlaceholder(c.channel.name)}
              aria-label={c.t.messagePlaceholder(c.channel.name)}
              value={c.value}
              onChange={(e) => c.setValue(e.target.value)}
              onKeyDown={c.onKeyDown}
              onPaste={c.onPaste}
            />
            <div className="composer__tools">
              <button className="iconbtn" aria-label={c.t.sendGif} title={c.t.sendGif} onClick={() => c.openFiles(true)}>
                <GifIcon size={20} />
              </button>
              <button className="iconbtn" aria-label={c.t.emojiPicker} title={c.t.emojiPicker} onClick={c.emojiAt}>
                <EmojiIcon size={20} />
              </button>
            </div>
          </div>
          {c.fileField}
        </div>
      )}
      <Typing />
    </div>
  );
}

function MobileComposer({ c }: { c: ReturnType<typeof useComposer> }) {
  const ref = useAutosize(c.value);
  return (
    <div className="mcomposer">
      <div className="mcomposer__typing">
        <Typing />
      </div>
      <ReplyBanner />
      {!c.canPost ? (
        <div className="mcomposer__box mcomposer__box--readonly" role="note">
          {c.readOnlyText}
        </div>
      ) : (
        <>
          <Tray c={c} />
          <div className="mcomposer__box">
            <button className="mcomposer__btn mcomposer__plus" aria-label={c.t.upload} onClick={() => c.openFiles()}>
              <PlusIcon size={22} strokeWidth={2} />
            </button>
            <textarea
              ref={(el) => {
                (ref as { current: HTMLTextAreaElement | null }).current = el;
                c.register(el);
              }}
              rows={1}
              className="mcomposer__input scroll-none"
              placeholder={c.t.messagePlaceholder(c.channel.name)}
              aria-label={c.t.messagePlaceholder(c.channel.name)}
              value={c.value}
              onChange={(e) => c.setValue(e.target.value)}
              onKeyDown={c.onKeyDown}
              onPaste={c.onPaste}
              enterKeyHint="send"
            />
            <button className="mcomposer__btn" aria-label={c.t.emojiPicker} onClick={c.emojiAt}>
              <EmojiFillIcon size={22} />
            </button>
            <button className="mcomposer__btn mcomposer__send" data-ready={c.canSend} aria-label="Send" disabled={!c.canSend} onClick={c.submit}>
              <SendIcon size={21} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DesktopHeader() {
  const channel = useCurrentChannel();
  const membersOpen = useLounge((s) => s.membersOpen);
  const toggleMembers = useLounge((s) => s.toggleMembers);
  const isOwner = useLounge((s) => s.role === "owner");
  const openBackstage = useLounge((s) => s.openBackstage);
  const guild = useCurrentGuild();
  const t = useT();
  const Icon = channel.staffOnly ? LockIcon : HashIcon;
  return (
    <header className="chat-head">
      <span style={{ color: "var(--icon-muted)" }} className="flex">
        <Icon size={20} />
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
          <ThreadsIcon size={20} />
        </button>
        <button className="iconbtn" aria-label="Notification settings">
          <BellIcon size={20} />
        </button>
        <button className="iconbtn" aria-label="Pinned messages">
          <PinIcon size={20} />
        </button>
        <button
          className="iconbtn"
          data-active={membersOpen}
          aria-pressed={membersOpen}
          aria-label={membersOpen ? "Hide member list" : "Show member list"}
          onClick={() => toggleMembers()}
        >
          <MembersIcon size={20} />
        </button>
        <label className="chat-search">
          <input placeholder={t.searchGuild(guild.name)} aria-label={t.search} />
          <SearchIcon size={15} />
        </label>
        {isOwner && (
          <button className="iconbtn" aria-label="Backstage" title="Backstage" onClick={() => openBackstage(true)}>
            <SlidersIcon size={20} />
          </button>
        )}
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
  const drop = useDropZone(composer);
  return (
    <main className="chat" aria-label={`#${composer.channel.name}`} {...drop.props}>
      {drop.over && (
        <div className="dropzone" aria-hidden>
          <div className="dropzone__card">{composer.t.dropToUpload}</div>
        </div>
      )}
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

