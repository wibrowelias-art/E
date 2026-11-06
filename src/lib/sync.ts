"use client";
/**
 * Simulator → database sync (Phase 2). While the owner's browser runs the
 * floor, NPC posts / reactions / presence changes are batched and flushed to
 * /api/sim/batch once a second. Guests receive them through the poll.
 */
import { api } from "./api";
import type { Message, User } from "./types";

const queue = { messages: [] as Message[], reactions: [] as Array<{ messageId: string; emoji: string }>, users: new Map<string, Partial<User>>() };
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = false;

export function enableSimSync(on: boolean) {
  enabled = on;
  if (on && !timer) timer = setInterval(flush, 1000);
  if (!on && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function queueSimMessage(m: Message) {
  if (enabled) queue.messages.push(m);
}
export function queueSimReaction(messageId: string, emoji: string) {
  if (enabled) queue.reactions.push({ messageId, emoji });
}
export function queueSimUser(id: string, patch: Partial<User>) {
  if (!enabled) return;
  // JSON drops `undefined`; the server needs an explicit null to clear voice.
  const clean: Record<string, unknown> = { ...queue.users.get(id), ...patch };
  if ("voiceChannelId" in patch && patch.voiceChannelId === undefined) clean.voiceChannelId = null;
  queue.users.set(id, clean as Partial<User>);
}

async function flush() {
  if (!queue.messages.length && !queue.reactions.length && !queue.users.size) return;
  const body = {
    messages: queue.messages.splice(0),
    reactions: queue.reactions.splice(0),
    users: [...queue.users.entries()].map(([id, patch]) => ({ id, patch })),
  };
  queue.users.clear();
  try {
    await api("/api/sim/batch", { body });
  } catch {
    // Put messages back once; reactions/presence are cosmetic.
    queue.messages.unshift(...body.messages.slice(0, 50));
  }
}
