/**
 * The always-on floor (Phase 3). The server plans NPC activity a few seconds
 * ahead and stores it; clients only read. Works without a long-running
 * process: every poll may advance the floor ("lazy ticking"), and a long gap
 * since the last tick is backfilled as believable, thinned-out history. On a
 * long-running server (`pnpm start`, Docker) the ticker in
 * src/instrumentation.ts also ticks every few seconds on its own.
 */
import type { Db, InStatement, Row } from "./sql";
import { randomBytes } from "node:crypto";
import { GUILDS } from "@/data/guilds";
import { BOT_ID, NPC_PROFILES } from "@/data/npcs";
import { safetyCheck } from "@/lib/safety";
import { expectedMessages, initialPlannerState, Planner, SIM_CHANNEL_WEIGHTS, type FloorEvent, type PlannerState, type World } from "@/lib/sim/planner";
import { clampSettings, DEFAULT_SIM } from "@/lib/sim/settings";
import { lowerChat, typingMs } from "@/lib/sim/style";
import type { Message, SimSettings, User } from "@/lib/types";
import { AI_TIMEOUT_MS, aiConfigured, liveReply, takeAiSlot } from "./ai";
import { BUMP_REV, CURRENT_REV } from "./db";
import { rowToUser } from "./repo";

export const TICK_EVERY_MS = 4_000;
export const LOOKAHEAD_MS = 12_000;
const LEASE_MS = 20_000;
const LIVE_WINDOW_MS = 3 * 60_000;
const MAX_GAP_MS = 12 * 3600_000;
const CATCHUP_CAP = 100;
const FLOOR_CHANNELS = [...Object.keys(SIM_CHANNEL_WEIGHTS), "c_intros"];

interface Loaded {
  world: World;
  state: PlannerState;
  lastPlannedAt: number | null;
}

function rowToMessageLite(r: Row): Message {
  const en = r.content_en === null ? undefined : String(r.content_en);
  const de = r.content_de === null ? undefined : String(r.content_de);
  return {
    id: String(r.id),
    channelId: String(r.channel_id),
    authorId: String(r.author_id),
    content: String(r.content),
    i18n: en && de ? { en, de } : undefined,
    createdAt: Number(r.created_at),
    replyToId: r.reply_to_id === null ? undefined : String(r.reply_to_id),
    isHuman: Number(r.is_human) === 1 || undefined,
    simTag: r.sim_tag === null ? undefined : String(r.sim_tag),
  };
}

export async function loadWorld(c: Db, now: number): Promise<Loaded> {
  const q = FLOOR_CHANNELS.map(() => "?").join(",");
  const [sim, users, recent, keys, human] = await Promise.all([
    c.execute("SELECT settings_json, state_json, last_planned_at FROM sim_state WHERE id = 1"),
    c.execute("SELECT * FROM users"),
    c.execute({
      sql: `SELECT * FROM (SELECT m.*, ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY created_at DESC) AS rn
            FROM messages m WHERE channel_id IN (${q})) AS t WHERE rn <= 60 ORDER BY created_at ASC`,
      args: FLOOR_CHANNELS,
    }),
    c.execute("SELECT content, content_en FROM messages ORDER BY created_at DESC LIMIT 200"),
    c.execute({ sql: "SELECT channel_id FROM messages WHERE is_human = 1 AND created_at > ? ORDER BY created_at DESC LIMIT 1", args: [now - 15 * 60_000] }),
  ]);
  const row = sim.rows[0];
  const settings: SimSettings = row?.settings_json ? clampSettings(JSON.parse(String(row.settings_json))) : { ...DEFAULT_SIM };
  let state: PlannerState = initialPlannerState(now);
  if (row?.state_json) {
    try {
      state = { ...state, ...(JSON.parse(String(row.state_json)) as PlannerState) };
    } catch {
      /* corrupt state → fresh planner */
    }
  }
  const byChannel = new Map<string, Message[]>();
  for (const r of recent.rows) {
    const m = rowToMessageLite(r);
    (byChannel.get(m.channelId) ?? byChannel.set(m.channelId, []).get(m.channelId)!).push(m);
  }
  const texts = keys.rows.map((r) => String(r.content_en ?? r.content)).reverse();
  return {
    world: {
      settings,
      users: new Map(users.rows.map((r) => [String(r.id), rowToUser(r)])),
      recent: byChannel,
      texts,
      focusChannel: human.rows[0] ? String(human.rows[0].channel_id) : undefined,
      rng: Math.random,
    },
    state,
    lastPlannedAt: row?.last_planned_at === null || row?.last_planned_at === undefined ? null : Number(row.last_planned_at),
  };
}

/** SQL that is true when Backstage paused the floor or muted the author bound to `?`. */
function pausedOrMuted(dialect: Db["dialect"]): string {
  return dialect === "pg"
    ? `(settings_json::jsonb ->> 'paused')::boolean IS TRUE OR (settings_json::jsonb -> 'muted') @> to_jsonb(CAST(? AS TEXT))`
    : `json_extract(settings_json, '$.paused') = 1 OR EXISTS (SELECT 1 FROM json_each(settings_json, '$.muted') WHERE value = ?)`;
}

/** Persist planner events: messages (scheduled with typing), reactions, presence / voice. */
export function eventStatements(events: FloorEvent[], dialect: Db["dialect"]): InStatement[] {
  const stmts: InStatement[] = [BUMP_REV];
  for (const e of events) {
    if (e.kind === "message") {
      const m = e.message;
      const texts = [m.content, m.i18n?.en, m.i18n?.de].filter((t): t is string => typeof t === "string");
      if (texts.some((t) => !safetyCheck(t).ok)) continue; // never persist anything the filter blocks
      // Guarded in the same transaction: if Backstage paused the floor or muted this NPC
      // after we planned, the line is dropped instead of slipping through.
      stmts.push({
        sql: `INSERT INTO messages (id, channel_id, author_id, content, content_en, content_de, created_at, reply_to_id, is_human, sim_tag, typing_ms, rev)
              SELECT CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT),
                     CAST(? AS BIGINT), CAST(? AS TEXT), 0, CAST(? AS TEXT), CAST(? AS BIGINT), ${CURRENT_REV}
              WHERE NOT EXISTS (SELECT 1 FROM sim_state WHERE id = 1 AND (${pausedOrMuted(dialect)}))
              ON CONFLICT DO NOTHING`,
        args: [m.id, m.channelId, m.authorId, m.content, m.i18n?.en ?? null, m.i18n?.de ?? null, m.createdAt, m.replyToId ?? null, m.simTag ?? null, e.typingMs, m.authorId],
      });
    } else if (e.kind === "reaction") {
      stmts.push({
        sql: `INSERT INTO reactions (message_id, emoji, npc_count, created_at)
              SELECT CAST(? AS TEXT), CAST(? AS TEXT), 1, CAST(? AS BIGINT) WHERE EXISTS (SELECT 1 FROM messages WHERE id = ?)
              ON CONFLICT (message_id, emoji) DO UPDATE SET npc_count = reactions.npc_count + 1`,
        args: [e.messageId, e.emoji, Math.round(e.at), e.messageId],
      });
      stmts.push({ sql: `UPDATE messages SET rev = ${CURRENT_REV} WHERE id = ?`, args: [e.messageId] });
    } else {
      const p = e.patch;
      stmts.push({
        sql: `UPDATE users SET presence = COALESCE(?, presence),
                voice_channel_id = CASE WHEN ? = 1 THEN ? ELSE voice_channel_id END,
                speaking = COALESCE(?, speaking), rev = ${CURRENT_REV}
              WHERE id = ? AND is_npc = 1`,
        args: [
          p.presence ?? null,
          "voiceChannelId" in p ? 1 : 0,
          "voiceChannelId" in p ? (p.voiceChannelId ?? null) : null,
          "speaking" in p ? (p.speaking ? 1 : 0) : null,
          e.userId,
        ],
      });
    }
  }
  return stmts;
}

function doormanLine(channelId: string, en: string, de: string, now: number): InStatement {
  return {
    sql: `INSERT INTO messages (id, channel_id, author_id, content, content_en, content_de, created_at, is_human, sim_tag, rev)
          VALUES (?,?,?,?,?,?,?,0,'system',${CURRENT_REV})`,
    args: [`m_sys_${now.toString(36)}_${randomBytes(3).toString("hex")}`, channelId, BOT_ID, en, en, de, now],
  };
}

function fmtGap(ms: number, lang: "en" | "de") {
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m} ${lang === "de" ? "Min." : "min"}`;
}

export interface TickResult {
  ran: boolean;
  paused?: boolean;
  messages: number;
  caughtUp: number;
  gapMs: number;
}

let lastLocalCheck = 0;

/**
 * Advance the floor if it's due. Safe to call from every request: a cheap
 * read decides, and a lease row makes sure only one instance plans at a time.
 */
export async function tick(c: Db, opts: { force?: boolean; now?: number } = {}): Promise<TickResult> {
  const now = opts.now ?? Date.now();
  const idle: TickResult = { ran: false, messages: 0, caughtUp: 0, gapMs: 0 };
  if (!opts.force) {
    if (now - lastLocalCheck < 1000) return idle;
    lastLocalCheck = now;
    const due = await c.execute("SELECT last_tick_at, lease_until FROM sim_state WHERE id = 1");
    const r = due.rows[0];
    if (!r) return idle;
    if (r.last_tick_at !== null && now - Number(r.last_tick_at) < TICK_EVERY_MS) return idle;
    if (r.lease_until !== null && Number(r.lease_until) > now) return idle;
  }
  const lease = randomBytes(6).toString("hex");
  const got = await c.execute({
    sql: "UPDATE sim_state SET lease_id = ?, lease_until = ? WHERE id = 1 AND (lease_until IS NULL OR lease_until < ?)",
    args: [lease, now + LEASE_MS, now],
  });
  if (got.rowsAffected !== 1) return idle;
  try {
    const { world, state, lastPlannedAt } = await loadWorld(c, now);
    const settings = world.settings;
    if (settings.paused) {
      // Paused time is not backfilled later.
      state.nextStepAt = now;
      await c.execute({
        sql: "UPDATE sim_state SET state_json = ?, last_planned_at = ?, last_tick_at = ? WHERE id = 1 AND lease_id = ?",
        args: [JSON.stringify(state), now, now, lease],
      });
      return { ...idle, ran: true, paused: true };
    }
    const planner = new Planner(world, state);
    const start = lastPlannedAt ?? now;
    let caughtUp = 0;
    const gapMs = Math.max(0, now - start);
    if (gapMs > LIVE_WINDOW_MS + 60_000) {
      // Nobody was here: backfill the gap as thinned-out history (no typing), capped.
      const from = Math.max(start, now - MAX_GAP_MS);
      const until = now - LIVE_WINDOW_MS;
      const expected = expectedMessages(settings.activity, from, until);
      state.nextStepAt = from;
      state.flurryLeft = 0;
      caughtUp = planner.advance(from, until, { density: Math.min(1, CATCHUP_CAP / Math.max(1, expected)), past: true, maxMessages: CATCHUP_CAP });
      state.nextStepAt = Math.min(state.nextStepAt, until);
    }
    planner.advance(Math.max(start, now - LIVE_WINDOW_MS), now + LOOKAHEAD_MS);
    const stmts = eventStatements(planner.events, c.dialect);
    if (caughtUp > 0) {
      stmts.push(
        doormanLine(
          "c_npcdebug",
          `Floor caught up ${fmtGap(gapMs, "en")} while nobody was watching: +${caughtUp} messages backfilled.`,
          `Floor hat ${fmtGap(gapMs, "de")} nachgeholt, in denen niemand zugeschaut hat: +${caughtUp} Nachrichten.`,
          now,
        ),
      );
    }
    stmts.push({
      sql: "UPDATE sim_state SET state_json = ?, last_planned_at = ?, last_tick_at = ? WHERE id = 1 AND lease_id = ?",
      args: [JSON.stringify(planner.state), now + LOOKAHEAD_MS, now, lease],
    });
    await c.batch(stmts, "write");
    return { ran: true, messages: planner.events.filter((e) => e.kind === "message").length, caughtUp, gapMs };
  } finally {
    await c.execute({ sql: "UPDATE sim_state SET lease_until = NULL, lease_id = NULL WHERE id = 1 AND lease_id = ?", args: [lease] }).catch(() => {});
  }
}

/** Never let a floor hiccup break a user request. */
export async function maybeTick(c: Db) {
  try {
    await tick(c);
  } catch (e) {
    console.error("[lounge] floor tick failed", e);
  }
}

/** How long a live (AI) answer may take: the scheduled line is held at least this long. */
const AI_HOLD_MS = AI_TIMEOUT_MS + 1_500;
const CHANNEL_NAMES = new Map(GUILDS.flatMap((g) => g.channels).map((ch) => [ch.id, ch.name]));
const PROFILES = new Map(NPC_PROFILES.map((p) => [p.userId, p]));

type MessageEvent = Extract<FloorEvent, { kind: "message" }>;

/**
 * A human posted → schedule NPC answers (owner: 1–3 replies; guest: a welcome).
 * The built-in lines are written right away, so someone always answers. With
 * live replies on (Backstage + ANTHROPIC_API_KEY), the direct answers are held
 * a few seconds longer ("typing…") and the returned task rewrites them with the
 * model while they're still invisible; run it after the response is sent.
 */
export async function scheduleReplies(c: Db, human: Message): Promise<(() => Promise<void>) | null> {
  try {
    const now = Date.now();
    const { world, state } = await loadWorld(c, now);
    if (world.settings.paused) return null;
    const channel = world.recent.get(human.channelId) ?? [];
    world.recent.set(human.channelId, channel);
    const before = channel.filter((m) => m.createdAt <= now && m.id !== human.id);
    channel.push(human);
    const planner = new Planner(world, state);
    planner.replyToHuman(human, now);
    const events = planner.events;
    const live = world.settings.liveReplies && aiConfigured();
    const author = world.users.get(human.authorId);
    const max = author?.roleId === "owner" ? 2 : 1;
    const targets = live
      ? events.filter((e): e is MessageEvent => e.kind === "message" && e.message.replyToId === human.id).slice(0, max)
      : [];
    // The model writes one message: a built-in burst it replaces goes out as one line (no follow-ups).
    const groups = new Set(targets.map((t) => t.group).filter((g): g is string => !!g));
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.kind === "message" && e.group && groups.has(e.group) && (e.part ?? 0) > 0) events.splice(i, 1);
    }
    for (const t of targets) {
      if (!t.whole) continue;
      t.message.content = t.whole.mix;
      t.message.i18n = { en: t.whole.en, de: t.whole.mix };
    }
    const planned = new Map(targets.map((t) => [t, t.message.createdAt]));
    if (targets.length) holdForLiveReplies(events, targets[0]!, now);
    await c.batch(eventStatements(events, c.dialect), "write");
    if (!targets.length) return null;
    const name = (id: string) => world.users.get(id)?.displayName ?? "someone";
    const recent = before.slice(-14).map((m) => ({ name: name(m.authorId), text: m.i18n?.en ?? m.content }));
    const to = { name: name(human.authorId), text: human.content, isOwner: author?.roleId === "owner" };
    return async () => {
      await Promise.all(
        targets.map((t, i) =>
          writeLiveReply(c, world, t, planned.get(t)!, { recent, to, second: i > 0 }).catch((e) => console.error("[lounge] live reply write failed", e)),
        ),
      );
    };
  } catch (e) {
    console.error("[lounge] scheduling replies failed", e);
    return null;
  }
}

/** Push the first direct answer (and everything after it) back so the model has time; typing starts as planned. */
function holdForLiveReplies(events: FloorEvent[], first: MessageEvent, now: number) {
  const from = first.message.createdAt;
  const delta = Math.max(0, now + AI_HOLD_MS - from);
  if (!delta) return;
  for (const e of events) {
    if (e.kind !== "message" || e.message.createdAt < from) continue;
    e.message.createdAt += delta;
    if (e === first) e.typingMs += delta;
  }
}

async function writeLiveReply(
  c: Db,
  world: World,
  target: MessageEvent,
  plannedAt: number,
  ctx: { recent: Array<{ name: string; text: string }>; to: { name: string; text: string; isOwner: boolean }; second: boolean },
) {
  const m = target.message;
  const npc = world.users.get(m.authorId);
  let reply =
    npc && (await takeAiSlot(c))
      ? await liveReply({
          npc,
          profile: PROFILES.get(npc.id),
          channelName: CHANNEL_NAMES.get(m.channelId) ?? "general",
          recent: ctx.recent,
          to: ctx.to,
          settings: world.settings,
          second: ctx.second,
        })
      : null;
  const typingStart = m.createdAt - target.typingMs;
  if (!npc || !reply) {
    // Keep the built-in line, but don't hold it back any longer than it was planned.
    const at = Date.now();
    const createdAt = Math.round(Math.max(at + 400, plannedAt));
    if (createdAt >= m.createdAt) return;
    await c.execute({
      sql: "UPDATE messages SET created_at = ?, typing_ms = ? WHERE id = ? AND is_human = 0 AND created_at > ?",
      args: [createdAt, Math.max(0, createdAt - typingStart), m.id, at + 250],
    });
    return;
  }
  const profile = PROFILES.get(npc.id);
  const german = Math.random() < (profile?.germanRatio ?? 0);
  // Same texting habit as the built-in lines: lowercase texters stay lowercase, no full stop.
  const lower = Math.random();
  const shape = (t: string) => (lower < (profile?.personality.lowercase ?? 0.85) ? lowerChat(t).replace(/(?<![.])\.$/, "") : t);
  reply = { en: shape(reply.en), de: shape(reply.de) };
  const mix = german ? reply.de : reply.en;
  const at = Date.now();
  const natural = Math.round(Math.min(20_000, Math.max(900, typingMs(mix, profile?.personality, Math.random))));
  const createdAt = Math.round(Math.min(m.createdAt, Math.max(at + 400, typingStart + natural)));
  // Only while it's still invisible; if it already went out (or Backstage removed it), the built-in line stands.
  await c.execute({
    sql: "UPDATE messages SET content = ?, content_en = ?, content_de = ?, created_at = ?, typing_ms = ? WHERE id = ? AND is_human = 0 AND created_at > ?",
    args: [mix, reply.en, mix, createdAt, Math.max(0, createdAt - typingStart), m.id, at + 250],
  });
}

/** Backstage "Start a burst" — six messages in one channel over the next seconds. */
export async function burst(c: Db, channelId: string): Promise<number> {
  const now = Date.now();
  const { world, state } = await loadWorld(c, now);
  const planner = new Planner(world, state);
  planner.burst(channelId, now);
  await c.batch(eventStatements(planner.events, c.dialect), "write");
  return planner.events.filter((e) => e.kind === "message").length;
}

/** Owner-visible audit line in #ops whenever Backstage changes. */
export function backstageLog(before: SimSettings, after: SimSettings, users: Map<string, User>, now: number): InStatement | null {
  const parts: string[] = [];
  const partsDe: string[] = [];
  const num = (k: "activity" | "glaze" | "drama", label: string, labelDe: string, fmt: (v: number) => string) => {
    if (before[k] !== after[k]) {
      parts.push(`${label} ${fmt(before[k])} → ${fmt(after[k])}`);
      partsDe.push(`${labelDe} ${fmt(before[k])} → ${fmt(after[k])}`);
    }
  };
  num("activity", "activity", "Aktivität", (v) => `${v.toFixed(2)}×`);
  num("glaze", "glaze", "Glaze", (v) => `${v}%`);
  num("drama", "drama", "Drama", (v) => `${v}%`);
  if (before.prompt !== after.prompt) parts.push("vibe prompt updated"), partsDe.push("Vibe-Prompt geändert");
  if (before.paused !== after.paused) parts.push(after.paused ? "floor paused" : "floor resumed"), partsDe.push(after.paused ? "Floor pausiert" : "Floor läuft wieder");
  if (before.breakCharacter !== after.breakCharacter) parts.push(`break character ${after.breakCharacter ? "on" : "off"}`), partsDe.push(`Rolle brechen ${after.breakCharacter ? "an" : "aus"}`);
  const name = (id: string) => users.get(id)?.displayName ?? id;
  const mutedNow = (after.muted ?? []).filter((id) => !(before.muted ?? []).includes(id));
  const unmuted = (before.muted ?? []).filter((id) => !(after.muted ?? []).includes(id));
  if (mutedNow.length) parts.push(`muted ${mutedNow.map(name).join(", ")}`), partsDe.push(`stumm: ${mutedNow.map(name).join(", ")}`);
  if (unmuted.length) parts.push(`unmuted ${unmuted.map(name).join(", ")}`), partsDe.push(`wieder laut: ${unmuted.map(name).join(", ")}`);
  if (!parts.length) return null;
  return doormanLine("c_ops", `Backstage: ${parts.join(" · ")}`, `Backstage: ${partsDe.join(" · ")}`, now);
}
