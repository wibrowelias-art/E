import type { Client, InStatement, Row } from "@libsql/client";
import { randomBytes } from "node:crypto";
import { GUILDS } from "@/data/guilds";
import { safetyCheck, SAFETY_MESSAGE } from "@/lib/safety";
import { clampSettings, DEFAULT_SIM } from "@/lib/sim/settings";
import type { Attachment, Message, Reaction, SimSettings, User } from "@/lib/types";
import type { Session } from "./auth";
import { BUMP_REV, CURRENT_REV } from "./db";

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

export function rowToUser(r: Row): User {
  return {
    id: String(r.id),
    username: String(r.username),
    displayName: String(r.display_name),
    avatar: { from: String(r.avatar_from), to: String(r.avatar_to), initials: String(r.initials) },
    roleId: String(r.role_id) as User["roleId"],
    isNpc: Number(r.is_npc) === 1,
    isBot: Number(r.is_bot) === 1 || undefined,
    isHuman: Number(r.is_human) === 1 || undefined,
    presence: String(r.presence) as User["presence"],
    statusText: str(r.status_text),
    statusEmoji: str(r.status_emoji),
    voiceChannelId: str(r.voice_channel_id),
    speaking: Number(r.speaking) === 1 || undefined,
    selfMute: Number(r.self_mute) === 1 || undefined,
    selfDeaf: Number(r.self_deaf) === 1 || undefined,
  };
}

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

async function reactionsFor(c: Client, ids: string[], viewerId: string): Promise<Map<string, Reaction[]>> {
  const out = new Map<string, Reaction[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    if (!chunk.length) continue;
    const q = chunk.map(() => "?").join(",");
    const res = await c.execute({
      sql: `SELECT r.message_id, r.emoji, r.npc_count,
              (SELECT COUNT(*) FROM reaction_users u WHERE u.message_id = r.message_id AND u.emoji = r.emoji) AS humans,
              (SELECT COUNT(*) FROM reaction_users u WHERE u.message_id = r.message_id AND u.emoji = r.emoji AND u.user_id = ?) AS mine
            FROM reactions r WHERE r.message_id IN (${q}) ORDER BY r.rowid`,
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

async function currentRev(c: Client): Promise<number> {
  const r = await c.execute("SELECT value FROM meta WHERE key = 'rev'");
  return Number(r.rows[0]?.value ?? 0);
}

/* ───────── reads ───────── */

export async function ensureGuest(c: Client, s: Session) {
  if (s.role !== "tourist") return;
  const [from, to] = s.grad ?? ["#5ee7df", "#4a6cf7"];
  await c.batch(
    [
      BUMP_REV,
      {
        sql: `INSERT OR IGNORE INTO users (id, username, display_name, avatar_from, avatar_to, initials, role_id, is_npc, is_bot, is_human, presence, created_at, rev)
              VALUES (?,?,?,?,?,?, 'tourist', 0, 0, 1, 'online', ?, ${CURRENT_REV})`,
        args: [s.uid, s.name.toLowerCase().replace(/\s+/g, "."), s.name, from, to, s.name.slice(0, 1).toUpperCase(), Date.now()],
      },
      { sql: "INSERT OR IGNORE INTO memberships VALUES ('g_lounge', ?, 'tourist')", args: [s.uid] },
    ],
    "write",
  );
}

export async function bootstrap(c: Client, s: Session) {
  await ensureGuest(c, s);
  const visible = visibleChannelIds(s);
  const q = visible.map(() => "?").join(",");
  const [users, msgs, sim, rev] = await Promise.all([
    c.execute("SELECT * FROM users WHERE is_human = 0 OR id = ? OR role_id = 'owner' OR rev > (SELECT value FROM meta WHERE key='rev') - 5000", [s.uid]),
    c.execute({
      sql: `SELECT * FROM (
              SELECT m.*, ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY created_at DESC) AS rn
              FROM messages m WHERE channel_id IN (${q})
            ) WHERE rn <= ${HISTORY_PER_CHANNEL} ORDER BY created_at ASC`,
      args: visible,
    }),
    s.role === "owner" ? getSim(c) : Promise.resolve(null),
    currentRev(c),
  ]);
  const reactions = await reactionsFor(c, msgs.rows.map((r) => String(r.id)), s.uid);
  return {
    users: users.rows.map(rowToUser),
    messages: msgs.rows.map((r) => rowToMessage(r, reactions)),
    sim,
    rev,
  };
}

export async function history(c: Client, s: Session, channelId: string, before: number, limit = 80) {
  if (!visibleChannelIds(s).includes(channelId)) throw new ApiError(403, "No access to this channel");
  const res = await c.execute({
    sql: "SELECT * FROM messages WHERE channel_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?",
    args: [channelId, before, Math.min(200, Math.max(1, limit))],
  });
  const rows = res.rows.slice().reverse();
  const reactions = await reactionsFor(c, rows.map((r) => String(r.id)), s.uid);
  return { messages: rows.map((r) => rowToMessage(r, reactions)), hasMore: res.rows.length === Math.min(200, Math.max(1, limit)) };
}

export async function poll(c: Client, s: Session, since: number) {
  const visible = visibleChannelIds(s);
  const q = visible.map(() => "?").join(",");
  const [msgs, users, rev] = await Promise.all([
    c.execute({ sql: `SELECT * FROM messages WHERE rev > ? AND channel_id IN (${q}) ORDER BY rev ASC LIMIT 400`, args: [since, ...visible] }),
    c.execute({ sql: "SELECT * FROM users WHERE rev > ? ORDER BY rev ASC LIMIT 400", args: [since] }),
    currentRev(c),
  ]);
  const reactions = await reactionsFor(c, msgs.rows.map((r) => String(r.id)), s.uid);
  // If we hit the limit, only advance the cursor as far as we actually read.
  const lastMsgRev = msgs.rows.length === 400 ? Number(msgs.rows[msgs.rows.length - 1]!.rev) : rev;
  return {
    messages: msgs.rows.map((r) => rowToMessage(r, reactions)),
    users: users.rows.map(rowToUser),
    rev: Math.min(rev, lastMsgRev),
  };
}

async function getMessage(c: Client, id: string, viewerId: string): Promise<Message | null> {
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

export async function postHuman(c: Client, s: Session, body: { channelId?: unknown; content?: unknown; replyToId?: unknown; clientId?: unknown }) {
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
  return getMessage(c, id, s.uid);
}

export async function editHuman(c: Client, s: Session, id: string, raw: unknown) {
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

export async function toggleHumanReaction(c: Client, s: Session, id: string, emoji: unknown) {
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
    stmts.push({ sql: "INSERT OR IGNORE INTO reactions (message_id, emoji, npc_count) VALUES (?,?,0)", args: [id, emoji] });
    stmts.push({ sql: "INSERT INTO reaction_users VALUES (?,?,?)", args: [id, emoji, s.uid] });
  }
  stmts.push({ sql: `UPDATE messages SET rev = ${CURRENT_REV} WHERE id = ?`, args: [id] });
  await c.batch(stmts, "write");
  return getMessage(c, id, s.uid);
}

/* ───────── writes (simulator, owner session only) ───────── */

interface SimBatch {
  messages?: Message[];
  reactions?: Array<{ messageId: string; emoji: string }>;
  users?: Array<{ id: string; patch: Partial<User> }>;
}

export async function simBatch(c: Client, s: Session, body: SimBatch) {
  if (s.role !== "owner") throw new ApiError(403, "Only the owner's floor writes simulator output.");
  const npcRows = await c.execute("SELECT id FROM users WHERE is_npc = 1");
  const npcs = new Set(npcRows.rows.map((r) => String(r.id)));
  const stmts: InStatement[] = [BUMP_REV];
  let accepted = 0;
  for (const m of (body.messages ?? []).slice(0, 100)) {
    // NPCs never post as a human or the bot, never in staff channels, always pass the safety filter.
    if (!npcs.has(m.authorId) || !TEXT_CHANNELS.some((ch) => ch.id === m.channelId && !ch.staffOnly)) continue;
    if (typeof m.content !== "string" || !m.content.trim() || m.content.length > MAX_LEN || !/^m_sim_[\w-]+$/.test(m.id)) continue;
    const texts = [m.content, m.i18n?.en, m.i18n?.de].filter((t): t is string => typeof t === "string");
    if (texts.some((t) => !safetyCheck(t).ok)) continue;
    stmts.push({
      sql: `INSERT OR IGNORE INTO messages (id, channel_id, author_id, content, content_en, content_de, created_at, reply_to_id, is_human, sim_tag, rev)
            VALUES (?,?,?,?,?,?,?,?,0,?,${CURRENT_REV})`,
      args: [m.id, m.channelId, m.authorId, m.content, m.i18n?.en ?? null, m.i18n?.de ?? null, Math.min(Date.now(), Number(m.createdAt) || Date.now()), m.replyToId ?? null, m.simTag ?? null],
    });
    accepted++;
  }
  for (const r of (body.reactions ?? []).slice(0, 200)) {
    if (typeof r.emoji !== "string" || !EMOJI_OK.test(r.emoji)) continue;
    stmts.push({
      sql: "INSERT INTO reactions (message_id, emoji, npc_count) SELECT ?, ?, 1 WHERE EXISTS (SELECT 1 FROM messages WHERE id = ?) ON CONFLICT(message_id, emoji) DO UPDATE SET npc_count = npc_count + 1",
      args: [r.messageId, r.emoji, r.messageId],
    });
    stmts.push({ sql: `UPDATE messages SET rev = ${CURRENT_REV} WHERE id = ?`, args: [r.messageId] });
  }
  for (const u of (body.users ?? []).slice(0, 100)) {
    if (!npcs.has(u.id)) continue;
    const p = u.patch ?? {};
    const presence = ["online", "idle", "dnd", "offline"].includes(String(p.presence)) ? String(p.presence) : null;
    stmts.push({
      sql: `UPDATE users SET
              presence = COALESCE(?, presence),
              voice_channel_id = CASE WHEN ? THEN ? ELSE voice_channel_id END,
              speaking = COALESCE(?, speaking),
              rev = ${CURRENT_REV}
            WHERE id = ?`,
      args: [
        presence,
        "voiceChannelId" in p ? 1 : 0,
        "voiceChannelId" in p ? (p.voiceChannelId ?? null) : null,
        "speaking" in p ? (p.speaking ? 1 : 0) : null,
        u.id,
      ],
    });
  }
  if (stmts.length > 1) await c.batch(stmts, "write");
  return { accepted };
}

/* ───────── Backstage settings ───────── */

export async function getSim(c: Client): Promise<SimSettings> {
  const r = await c.execute("SELECT settings_json FROM sim_state WHERE id = 1");
  const raw = r.rows[0]?.settings_json;
  return raw ? clampSettings(JSON.parse(String(raw))) : { ...DEFAULT_SIM };
}

export async function putSim(c: Client, s: Session, body: unknown): Promise<SimSettings> {
  if (s.role !== "owner") throw new ApiError(403, "Backstage is owner-only.");
  const settings = clampSettings({ ...(await getSim(c)), ...(body as Partial<SimSettings>) });
  await c.execute({
    sql: "INSERT INTO sim_state (id, settings_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
    args: [JSON.stringify(settings), Date.now()],
  });
  return settings;
}
