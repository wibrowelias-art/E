"use client";
/**
 * Local floor (no database, `?local=1`): the same Planner the server ticks,
 * driven by browser timers. Every second it plans the next couple of seconds
 * and schedules what happens — typing indicator first, then the message;
 * reactions and presence changes at their time. A human post gets answers the
 * same way the server does it (2–40 s, sometimes nobody, sometimes a reaction).
 * Coming back to a hidden tab backfills the gap as history.
 */
import { useEffect } from "react";
import { useLounge } from "@/lib/store";
import type { Message } from "@/lib/types";
import { expectedMessages, initialPlannerState, Planner, SIM_CHANNEL_WEIGHTS, type FloorEvent, type World } from "./planner";

const TICK_MS = 1000;
const LOOKAHEAD_MS = 2000;

export function useSimulation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const S = () => useLounge.getState();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (!stopped) fn();
      }, Math.max(0, ms));
      timers.add(t);
    };
    /** Planned but not posted yet (the planner must see them: uniqueness, who's talking). */
    const scheduled = new Map<string, Message>();

    const currentChannel = () => {
      const st = S();
      const ch = st.channelByGuild[st.guildId] ?? "c_general";
      return SIM_CHANNEL_WEIGHTS[ch] ? ch : "c_general";
    };

    // Cold open: the room is already talking where you look.
    const state = initialPlannerState(Date.now());
    state.flurryChannel = currentChannel();
    state.flurryLeft = 4 + Math.floor(Math.random() * 2);

    /** A snapshot of the store for the planner (copies — the planner mutates its world). */
    const world = (): World => {
      const st = S();
      const recent = new Map<string, Message[]>();
      const add = (m: Message) => (recent.get(m.channelId) ?? recent.set(m.channelId, []).get(m.channelId)!).push({ ...m });
      for (const m of st.messages.slice(-600)) add(m);
      for (const m of scheduled.values()) add(m);
      for (const list of recent.values()) list.sort((a, b) => a.createdAt - b.createdAt);
      return {
        settings: st.sim,
        users: new Map(Object.values(st.users).map((u) => [u.id, { ...u }])),
        recent,
        texts: [...st.messages.slice(-250), ...scheduled.values()].map((m) => m.i18n?.en ?? m.content),
        focusChannel: currentChannel(),
        rng: Math.random,
      };
    };

    const blocked = (authorId: string) => S().sim.paused || (S().sim.muted ?? []).includes(authorId);

    /** Schedule planner events on the real clock. */
    const apply = (events: FloorEvent[]) => {
      const now = Date.now();
      for (const e of events) {
        if (e.kind === "message") {
          const m = e.message;
          scheduled.set(m.id, m);
          if (e.typingMs > 0) later(m.createdAt - e.typingMs - now, () => !blocked(m.authorId) && S().setTyping(m.channelId, m.authorId, true));
          later(m.createdAt - now, () => {
            scheduled.delete(m.id);
            if (blocked(m.authorId)) return S().setTyping(m.channelId, m.authorId, false);
            S().npcPost(m, m.simTag ?? "topic");
          });
        } else if (e.kind === "reaction") {
          later(e.at - now, () => !S().sim.paused && !(e.by && blocked(e.by)) && S().npcReact(e.messageId, e.emoji));
        } else {
          later(e.at - now, () => S().patchUser(e.userId, e.patch));
        }
      }
    };

    /* ── the clock ── */
    const tick = () => {
      const st = S();
      if (!st.ready) return later(400, tick);
      const now = Date.now();
      if (st.sim.paused) {
        state.nextStepAt = now; // paused time is not made up later
        return later(TICK_MS, tick);
      }
      const p = new Planner(world(), state);
      p.advance(now, now + LOOKAHEAD_MS);
      apply(p.events);
      later(TICK_MS, tick);
    };

    /* ── Backstage "Start a burst": a flurry right where you're looking ── */
    const unsubscribeBurst = useLounge.subscribe((s, prev) => {
      if (s.burstSeq === prev.burstSeq) return;
      const p = new Planner(world(), state);
      p.burst(currentChannel(), Date.now());
      apply(p.events);
    });

    /* ── a human speaks → maybe someone answers (same rules as the server) ── */
    const handled = new Set<string>();
    const startedAt = Date.now();
    const unsubscribe = useLounge.subscribe((s, prev) => {
      if (s.messages === prev.messages || s.sim.paused) return;
      // Own messages are answered once, on the optimistic copy (m_local_); others' by server id.
      const last = s.messages
        .slice(-12)
        .reverse()
        .find(
          (m) =>
            m.isHuman &&
            !m.failed &&
            m.createdAt >= startedAt - 5000 &&
            !handled.has(m.id) &&
            (m.authorId === s.viewerId ? m.id.startsWith("m_local_") : true),
        );
      if (!last) return;
      handled.add(last.id);
      const w = world();
      const human = w.recent.get(last.channelId)?.find((m) => m.id === last.id) ?? { ...last };
      const p = new Planner(w, state);
      p.replyToHuman(human, Date.now());
      apply(p.events);
    });

    /* ── tab hidden → fill in history when you come back ── */
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const now = Date.now();
      const away = now - hiddenAt;
      if (!hiddenAt || away < 45_000 || S().sim.paused) return;
      hiddenAt = 0;
      const from = Math.max(state.nextStepAt, now - away);
      const p = new Planner(world(), state);
      const expected = expectedMessages(S().sim.activity, from, now);
      p.advance(from, now - 1000, { past: true, density: Math.min(1, 30 / Math.max(1, expected)), maxMessages: 30 });
      for (const e of p.events) {
        if (e.kind === "message") S().npcPost(e.message, e.message.simTag ?? "topic");
        else if (e.kind === "reaction") S().npcReact(e.messageId, e.emoji);
        else S().patchUser(e.userId, e.patch);
      }
      useLounge.setState((s) => ({ messages: [...s.messages].sort((x, y) => x.createdAt - y.createdAt) }));
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Seeded "typing" was a static fake; the live sim owns typing from here on.
    useLounge.setState({ typing: {} });
    later(200, tick);

    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      unsubscribe();
      unsubscribeBurst();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
