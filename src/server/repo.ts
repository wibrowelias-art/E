import type { Db, InStatement, Row } from "./sql";
import { randomBytes } from "node:crypto";
import { GUILDS } from "@/data/guilds";
import { safetyCheck, SAFETY_MESSAGE } from "@/lib/safety";
import { clampSettings, DEFAULT_SIM } from "@/lib/sim/settings";
import type { Attachment, Message, Reaction, SimSettings } from "@/lib/types";
import type { Session } from "./auth";
import { BUMP_REV, CURRENT_REV } from "./db";
import { backstageLog, LOOKAHEAD_MS, scheduleReplies } from "./floor";
import { rowToUser } from "./rows";

export { rowToUser };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const CHANNELS = GUILDS.flatMap((g) => g.channels);
const TEXT_CHANNELS = CHANNELS.filter((c) => c.kind === "text");
/** Tourists (guests) are read-mostly: they react everywhere and post here. */
export const GUEST_POST_CHANNELS = new Set(["c_intros"]);
const MAX_LEN = 2000;
const HISTORY_PER_CHANNEL = 120;

export function visibleChannelIds(s: Session): string[] {
  return TEXT_CHANNELS.filter((c) => !c.staffOnly || s.role === "owner").map((c) => c.id);
}

function canPost(s: Session, channelId: string): boolean {
  const ch = TEXT_CHANNELS.find((c) => c.id === channelId);
  if (!ch) return false;
  if (s.role === "owner") return true;
  if (ch.staffOnly || ch.id === "c_welcome") return false;
  if (s.role === "tourist") return GUEST_POST_CHANNELS.has(channelId);
  return true;
}

/* ───────── mapping ───────── */

const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

function rowToMessage(r: Row, reactions: Map<string, Reaction[]>): Message {
  const en = str(r.content_en);
  const de = str(r.content_de);
  return {
    id: String(r.id),
    channelId: String(r.channel_id),
    authorId: String(r.author_id),
    content: String(r.content),
    i18n: en && de ? { en, de } : undefined,
    createdAt: Number(r.created_at),
    editedAt: n(r.edited_at),
    replyToId: str(r.reply_to_id),
    isHuman: Number(r.is_human) === 1 || undefined,
    simTag: str(r.sim_tag),
    attachments: r.attachments_json ? (JSON.parse(String(r.attachments_json)) as Attachment[]) : undefined,
    reactions: reactions.get(String(r.id)),
  };
}

async function reactionsFor(c: Db, ids: string[], viewerId: string): Promise<Map<string, Reaction[]>> {
  const out = new Map<string, Reaction[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    if (!chunk.length) continue;
    const q = chunk.map(() => "?").join(",");
    const res = await c.execute({
      sql: `SELECT r.message_id, r.emoji, r.npc_count,
              (SELECT COUNT(*) FROM reaction_users u WHERE u.message_id = r.message_id AND u.emoji = r.emoji) AS humans,
              (SELECT COUNT(*) FROM reaction_users u WHERE u.message_id = r.message_id AND u.emoji = r.emoji AND u.user_id = ?) AS mine
            FROM reactions r WHERE r.message_id IN (${q}) ORDER BY r.created_at, r.emoji`,
      args: [viewerId, ...chunk],
    });
    for (const row of res.rows) {
      const count = Number(row.npc_count) + Number(row.humans);
      if (count <= 0) continue;
      const list = out.get(String(row.message_id)) ?? [];
      list.push({ emoji: String(row.emoji), count, me: Number(row.mine) > 0 });
      out.set(String(row.message_id), list);
    }
  }
  return out;
}

async function currentRev(c: Db): Promise<number> {
  const r = await c.execute("SELECT value FROM meta WHERE key = 'rev'");
  return Number(r.rows[0]?.value ?? 0);
}

/* ───────── reads ───────── */

export async function ensureGuest(c: Db, s: Session) {
  if (s.role !== "tourist") return;
  const [from, to] = s.grad ?? ["#5ee7df", "#4a6cf7"];
  await c.batch(
    [
      BUMP_REV,
      {
        sql: `INSERT INTO users (id, username, display_name, avatar_from, avatar_to, initials, role_id, is_npc, is_bot, is_human, presence, created_at, rev)
              VALUES (?,?,?,?,?,?, 'tourist', 0, 0, 1, 'online', ?, ${CURRENT_REV}) ON CONFLICT DO NOTHING`,
        args: [s.uid, s.name.toLowerCase().replace(/\s+/g, "."), s.name, from, to, s.name.slice(0, 1).toUpperCase(), Date.now()],
      },
      { sql: "INSERT INTO memberships (guild_id, user_id, role_id) VALUES ('g_lounge', ?, 'tourist') ON CONFLICT DO NOTHING", args: [s.uid] },
    ],
    "write",
  );
}

async function typingNow(c: Db, visible: string[], now: number) {
  const q = visible.map(() => "?").join(",");
  const r = await c.execute({
    sql: `SELECT DISTINCT channel_id, author_id FROM messages
          WHERE created_at > ? AND created_at <= ? AND typing_ms > 0 AND created_at - typing_ms <= ? AND channel_id IN (${q})`,
    args: [now, now + LOOKAHEAD_MS + 3000, now, ...visible],
  });
  return r.rows.map((row) => ({ channelId: String(row.channel_id), userId: String(row.author_id) }));
}

export async function bootstrap(c: Db, s: Session) {
  await ensureGuest(c, s);
  const visible = visibleChannelIds(s);
  const q = visible.map(() => "?").join(",");
  const now = Date.now();
  const [users, msgs, sim, rev, typing] = await Promise.all([
    c.execute("SELECT * FROM users WHERE is_human = 0 OR id = ? OR role_id = 'owner' OR rev > (SELECT value FROM meta WHERE key='rev') - 5000", [s.uid]),
    c.execute({
      sql: `SELECT * FROM (
              SELECT m.*, ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY created_at DESC) AS rn
              FROM messages m WHERE channel_id IN (${q}) AND created_at <= ?
            ) AS t WHERE rn <= ${HISTORY_PER_CHANNEL} ORDER BY created_at ASC`,
      args: [...visible, now],
    }),
    s.role === "owner" ? getSim(c) : Promise.resolve(null),
    currentRev(c),
    typingNow(c, visible, now),
  ]);
  const reactions = await reactionsFor(c, msgs.rows.map((r) => String(r.id)), s.uid);
  return {
    users: users.rows.map(rowToUser),
    messages: msgs.rows.map((r) => rowToMessage(r, reactions)),
    sim,
    rev,
    serverNow: now,
    typing,
  };
}

export async function history(c: Db, s: Session, channelId: string, before: number, limit = 80) {
  if (!visibleChannelIds(s).includes(channelId)) throw new ApiError(403, "No access to this channel");
  const res = await c.execute({
    sql: "SELECT * FROM messages WHERE channel_id = ? AND created_at < ? AND created_at <= ? ORDER BY created_at DESC LIMIT ?",
    args: [channelId, before, Date.now(), Math.min(200, Math.max(1, limit))],
  });
  const rows = res.rows.slice().reverse();
  const reactions = await reactionsFor(c, rows.map((r) => String(r.id)), s.uid);
  return { messages: rows.map((r) => rowToMessage(r, reactions)), hasMore: res.rows.length === Math.min(200, Math.max(1, limit)) };
}

/**
 * Changes since the client's cursors: `since` (revision) catches writes,
 * `after` (server time of the previous poll) catches scheduled floor messages
 * that were written earlier but only became visible now.
 */
export async function poll(c: Db, s: Session, since: number, after: number) {
  const visible = visibleChannelIds(s);
  const q = visible.map(() => "?").join(",");
  const now = Date.now();
  const LIMIT = 400;
  const [byRev, byTime, users, rev, typing] = await Promise.all([
    // 1) everything written since the revision cursor (new, edited, reacted) that's visible
    c.execute({
      sql: `SELECT * FROM messages WHERE channel_id IN (${q}) AND rev > ? AND created_at <= ? ORDER BY rev ASC LIMIT ${LIMIT}`,
      args: [...visible, since, now],
    }),
    // 2) scheduled floor lines written earlier that became visible since the last poll
    c.execute({
      sql: `SELECT * FROM messages WHERE channel_id IN (${q}) AND rev <= ? AND created_at > ? AND created_at <= ? ORDER BY created_at ASC LIMIT ${LIMIT}`,
      args: [...visible, since, after || now, now],
    }),
    c.execute({ sql: "SELECT * FROM users WHERE rev > ? ORDER BY rev ASC LIMIT 400", args: [since] }),
    currentRev(c),
    typingNow(c, visible, now),
  ]);
  const rows = [...byRev.rows, ...byTime.rows];
  const reactions = await reactionsFor(c, rows.map((r) => String(r.id)), s.uid);
  // A full page means more is waiting: advance only as far as we read. One write batch shares a
  // revision, so step back one to re-read a partially read batch (duplicates merge by id).
  let nextRev = rev;
  if (byRev.rows.length === LIMIT) {
    const last = Number(byRev.rows[LIMIT - 1]!.rev);
    nextRev = last - 1 > since ? last - 1 : last;
  }
  const nextAfter = byTime.rows.length === LIMIT ? Number(byTime.rows[LIMIT - 1]!.created_at) : now;
  return {
    messages: rows.map((r) => rowToMessage(r, reactions)).sort((a, b) => a.createdAt - b.createdAt),
    users: users.rows.map(rowToUser),
    rev: nextRev,
    serverNow: nextAfter,
    typing,
  };
}

async function getMessage(c: Db, id: string, viewerId: string): Promise<Message | null> {
  const r = await c.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [id] });
  const row = r.rows[0];
  if (!row) return null;
  return rowToMessage(row, await reactionsFor(c, [id], viewerId));
}

/* ───────── writes (humans) ───────── */

const buckets = new Map<string, number[]>();
function rateLimit(s: Session) {
  const now = Date.now();
  const windowMs = s.role === "owner" ? 5000 : 6000;
  const max = s.role === "owner" ? 8 : 3;
  const list = (buckets.get(s.uid) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new ApiError(429, "Slow down a little.");
  list.push(now);
  buckets.set(s.uid, list);
}

function cleanText(raw: unknown): string {
  if (typeof raw !== "string") throw new ApiError(400, "Message must be text.");
  const text = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!text) throw new ApiError(400, "Message is empty.");
  if (text.length > MAX_LEN) throw new ApiError(400, `Messages are limited to ${MAX_LEN} characters.`);
  const safe = safetyCheck(text);
  if (!safe.ok) throw new ApiError(422, SAFETY_MESSAGE[safe.reason]);
  return text;
}

export async function postHuman(c: Db, s: Session, body: { channelId?: unknown; content?: unknown; replyToId?: unknown; clientId?: unknown }) {
  const channelId = String(body.channelId ?? "");
  if (!canPost(s, channelId)) {
    throw new ApiError(403, s.role === "tourist" ? "Guests can post in #introductions. Everything else is read-only for you." : "You can't post in this channel.");
  }
  const content = cleanText(body.content);
  rateLimit(s);
  await ensureGuest(c, s);
  let replyToId: string | null = null;
  if (typeof body.replyToId === "string" && body.replyToId) {
    const parent = await c.execute({ sql: "SELECT id FROM messages WHERE id = ? AND channel_id = ?", args: [body.replyToId, channelId] });
    replyToId = parent.rows[0] ? body.replyToId : null;
  }
  const id = `m_h_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  await c.batch(
    [
      BUMP_REV,
      {
        sql: `INSERT INTO messages (id, channel_id, author_id, content, created_at, reply_to_id, is_human, rev)
              VALUES (?,?,?,?,?,?,1,${CURRENT_REV})`,
        args: [id, channelId, s.uid, content, Date.now(), replyToId],
      },
    ],
    "write",
  );
  const message = await getMessage(c, id, s.uid);
  if (message) await scheduleReplies(c, message); // NPCs answer — even if nobody's browser is open
  return message;
}

export async function editHuman(c: Db, s: Session, id: string, raw: unknown) {
  const content = cleanText(raw);
  const r = await c.execute({ sql: "SELECT author_id FROM messages WHERE id = ?", args: [id] });
  if (!r.rows[0]) throw new ApiError(404, "Message not found.");
  if (String(r.rows[0].author_id) !== s.uid) throw new ApiError(403, "You can only edit your own messages.");
  await c.batch(
    [BUMP_REV, { sql: `UPDATE messages SET content = ?, edited_at = ?, rev = ${CURRENT_REV} WHERE id = ?`, args: [content, Date.now(), id] }],
    "write",
  );
  return getMessage(c, id, s.uid);
}

const EMOJI_OK = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️]{1,16}$/u;

export async function toggleHumanReaction(c: Db, s: Session, id: string, emoji: unknown) {
  if (typeof emoji !== "string" || !EMOJI_OK.test(emoji)) throw new ApiError(400, "Not an emoji.");
  const m = await c.execute({ sql: "SELECT channel_id FROM messages WHERE id = ?", args: [id] });
  if (!m.rows[0]) throw new ApiError(404, "Message not found.");
  if (!visibleChannelIds(s).includes(String(m.rows[0].channel_id))) throw new ApiError(403, "No access to this channel.");
  await ensureGuest(c, s);
  const has = await c.execute({ sql: "SELECT 1 FROM reaction_users WHERE message_id = ? AND emoji = ? AND user_id = ?", args: [id, emoji, s.uid] });
  const stmts: InStatement[] = [BUMP_REV];
  if (has.rows.length) {
    stmts.push({ sql: "DELETE FROM reaction_users WHERE message_id = ? AND emoji = ? AND user_id = ?", args: [id, emoji, s.uid] });
  } else {
    stmts.push({ sql: "INSERT INTO reactions (message_id, emoji, npc_count, created_at) VALUES (?,?,0,?) ON CONFLICT DO NOTHING", args: [id, emoji, Date.now()] });
    stmts.push({ sql: "INSERT INTO reaction_users (message_id, emoji, user_id) VALUES (?,?,?)", args: [id, emoji, s.uid] });
  }
  stmts.push({ sql: `UPDATE messages SET rev = ${CURRENT_REV} WHERE id = ?`, args: [id] });
  await c.batch(stmts, "write");
  return getMessage(c, id, s.uid);
}

/* ───────── Backstage settings ───────── */

export async function getSim(c: Db): Promise<SimSettings> {
  const r = await c.execute("SELECT settings_json FROM sim_state WHERE id = 1");
  const raw = r.rows[0]?.settings_json;
  return raw ? clampSettings(JSON.parse(String(raw))) : { ...DEFAULT_SIM };
}

export async function putSim(c: Db, s: Session, body: unknown): Promise<SimSettings> {
  if (s.role !== "owner") throw new ApiError(403, "Backstage is owner-only.");
  const before = await getSim(c);
  const settings = clampSettings({ ...before, ...(body as Partial<SimSettings>) });
  const now = Date.now();
  const stmts: InStatement[] = [
    BUMP_REV,
    {
      sql: "INSERT INTO sim_state (id, settings_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
      args: [JSON.stringify(settings), now],
    },
  ];
  // Pause / mute take effect immediately: drop lines that are scheduled but not visible yet.
  if (!before.paused && settings.paused) {
    stmts.push({ sql: "DELETE FROM messages WHERE id LIKE 'm_sim_%' AND created_at > ?", args: [now] });
  }
  for (const id of (settings.muted ?? []).filter((m) => !(before.muted ?? []).includes(m))) {
    stmts.push({ sql: "DELETE FROM messages WHERE id LIKE 'm_sim_%' AND author_id = ? AND created_at > ?", args: [id, now] });
  }
  const users = await c.execute("SELECT * FROM users WHERE is_npc = 1");
  const log = backstageLog(before, settings, new Map(users.rows.map((r) => [String(r.id), rowToUser(r)])), now);
  if (log) stmts.push(log);
  await c.batch(stmts, "write");
  return settings;
}
