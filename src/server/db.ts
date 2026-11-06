/**
 * Persistence (Phase 2): libSQL / SQLite.
 *  - local dev:   file:./data/lounge.db (created on first request)
 *  - production:  DATABASE_URL=libsql://<db>.turso.io + DATABASE_AUTH_TOKEN
 *  - Vercel without DATABASE_URL: no database → the app runs in local
 *    (in-browser) mode instead of failing, and Backstage says so.
 */
import { createClient, type Client, type InStatement } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { GUILDS } from "@/data/guilds";
import { ALL_USERS, NPC_PROFILES } from "@/data/npcs";
import { buildSeed } from "@/data/seed";
import { DEFAULT_SIM } from "@/lib/sim/settings";

export function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Vercel/serverless file systems are read-only → require a hosted database there.
  if (process.env.VERCEL) return null;
  return "file:./data/lounge.db";
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_from TEXT NOT NULL,
  avatar_to TEXT NOT NULL,
  initials TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_npc INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  is_human INTEGER NOT NULL DEFAULT 0,
  presence TEXT NOT NULL DEFAULT 'offline',
  status_text TEXT,
  status_emoji TEXT,
  voice_channel_id TEXT,
  speaking INTEGER NOT NULL DEFAULT 0,
  self_mute INTEGER NOT NULL DEFAULT 0,
  self_deaf INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_rev ON users (rev);
CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, name TEXT NOT NULL, acronym TEXT, icon_json TEXT, owner_id TEXT, position INTEGER);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT NOT NULL, slashes INTEGER DEFAULT 0, staff_only INTEGER DEFAULT 0, position INTEGER);
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, category_id TEXT, kind TEXT NOT NULL, name TEXT NOT NULL,
  emoji TEXT, topic TEXT, staff_only INTEGER DEFAULT 0, slowmode INTEGER, locked INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, position INTEGER
);
CREATE TABLE IF NOT EXISTS memberships (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY (guild_id, user_id));
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_en TEXT,
  content_de TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  reply_to_id TEXT,
  is_human INTEGER NOT NULL DEFAULT 0,
  sim_tag TEXT,
  attachments_json TEXT,
  rev INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_channel_created ON messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS messages_rev ON messages (rev);
CREATE TABLE IF NOT EXISTS reactions (message_id TEXT NOT NULL, emoji TEXT NOT NULL, npc_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (message_id, emoji));
CREATE TABLE IF NOT EXISTS reaction_users (message_id TEXT NOT NULL, emoji TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (message_id, emoji, user_id));
CREATE TABLE IF NOT EXISTS npc_profiles (user_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS relationships (from_id TEXT NOT NULL, to_id TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1, PRIMARY KEY (from_id, to_id));
CREATE TABLE IF NOT EXISTS sim_state (id INTEGER PRIMARY KEY CHECK (id = 1), settings_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
INSERT OR IGNORE INTO meta (key, value) VALUES ('rev', 1);
`;

/** Every write bumps one global revision; clients poll with `since=<rev>`. */
export const BUMP_REV: InStatement = "UPDATE meta SET value = value + 1 WHERE key = 'rev'";
export const CURRENT_REV = "(SELECT value FROM meta WHERE key = 'rev')";

let client: Client | null | undefined;
let ready: Promise<Client | null> | null = null;
export let persistenceError: string | null = null;

/** Resolves to a ready client, or null when no database is configured / reachable. */
export function db(): Promise<Client | null> {
  ready ??= init();
  return ready;
}

async function init(): Promise<Client | null> {
  const url = databaseUrl();
  if (!url) return null;
  try {
    if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
    client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
    if (url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL");
    await client.executeMultiple(SCHEMA);
    await migrate(client);
    await seedIfEmpty(client);
    return client;
  } catch (e) {
    persistenceError = e instanceof Error ? e.message : String(e);
    console.error("[lounge] database unavailable, falling back to local mode:", persistenceError);
    ready = null; // retry on the next request
    return null;
  }
}

/** Additive migrations for databases created by earlier phases. */
async function migrate(c: Client) {
  const columns = async (table: string) => new Set((await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name)));
  const add = async (table: string, have: Set<string>, col: string, def: string) => {
    if (!have.has(col)) await c.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  const msg = await columns("messages");
  // Phase 3: server floor — typing time before a scheduled message becomes visible
  await add("messages", msg, "typing_ms", "INTEGER NOT NULL DEFAULT 0");
  const sim = await columns("sim_state");
  await add("sim_state", sim, "state_json", "TEXT");
  await add("sim_state", sim, "last_planned_at", "INTEGER");
  await add("sim_state", sim, "last_tick_at", "INTEGER");
  await add("sim_state", sim, "lease_id", "TEXT");
  await add("sim_state", sim, "lease_until", "INTEGER");
  await c.execute("CREATE INDEX IF NOT EXISTS messages_created ON messages (created_at)");
}

async function seedIfEmpty(c: Client) {
  const r = await c.execute("SELECT COUNT(*) AS n FROM users");
  if (Number(r.rows[0]?.n ?? 0) > 0) return;
  await seed(c, Date.now());
}

/** Writes guilds, channels, cast, relationships and the backlog. */
export async function seed(c: Client, now: number) {
  const snap = buildSeed(now);
  const stmts: InStatement[] = [BUMP_REV];
  for (const u of ALL_USERS) {
    stmts.push({
      sql: `INSERT OR REPLACE INTO users (id, username, display_name, avatar_from, avatar_to, initials, role_id, is_npc, is_bot, is_human,
            presence, status_text, status_emoji, voice_channel_id, speaking, self_mute, self_deaf, created_at, rev)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${CURRENT_REV})`,
      args: [
        u.id, u.username, u.displayName, u.avatar.from, u.avatar.to, u.avatar.initials, u.roleId,
        u.isNpc ? 1 : 0, u.isBot ? 1 : 0, u.isHuman ? 1 : 0, u.presence, u.statusText ?? null, u.statusEmoji ?? null,
        u.voiceChannelId ?? null, u.speaking ? 1 : 0, u.selfMute ? 1 : 0, u.selfDeaf ? 1 : 0, now,
      ],
    });
  }
  GUILDS.forEach((g, gi) => {
    stmts.push({ sql: "INSERT OR REPLACE INTO guilds VALUES (?,?,?,?,?,?)", args: [g.id, g.name, g.acronym, JSON.stringify(g.icon), g.ownerId, gi] });
    g.categories.forEach((k, i) =>
      stmts.push({ sql: "INSERT OR REPLACE INTO categories VALUES (?,?,?,?,?,?)", args: [k.id, g.id, k.name, k.slashes ? 1 : 0, k.staffOnly ? 1 : 0, i] }),
    );
    g.channels.forEach((ch, i) =>
      stmts.push({
        sql: "INSERT OR REPLACE INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [ch.id, g.id, ch.categoryId, ch.kind, ch.name, ch.emoji ?? null, ch.topic ?? null, ch.staffOnly ? 1 : 0, ch.slowmode ?? null, ch.locked ? 1 : 0, ch.isNew ? 1 : 0, i],
      }),
    );
    for (const uid of g.memberIds) {
      const u = ALL_USERS.find((x) => x.id === uid);
      stmts.push({ sql: "INSERT OR REPLACE INTO memberships VALUES (?,?,?)", args: [g.id, uid, u?.roleId ?? "regular"] });
    }
  });
  for (const p of NPC_PROFILES) {
    stmts.push({ sql: "INSERT OR REPLACE INTO npc_profiles VALUES (?,?)", args: [p.userId, JSON.stringify(p)] });
    for (const to of p.relationships) stmts.push({ sql: "INSERT OR REPLACE INTO relationships VALUES (?,?,1)", args: [p.userId, to] });
  }
  for (const m of snap.messages) {
    stmts.push({
      sql: `INSERT OR REPLACE INTO messages (id, channel_id, author_id, content, content_en, content_de, created_at, edited_at, reply_to_id, is_human, sim_tag, attachments_json, rev)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${CURRENT_REV})`,
      args: [
        m.id, m.channelId, m.authorId, m.content, m.i18n?.en ?? null, m.i18n?.de ?? null, m.createdAt, m.editedAt ?? null,
        m.replyToId ?? null, m.isHuman ? 1 : 0, m.simTag ?? null, m.attachments ? JSON.stringify(m.attachments) : null,
      ],
    });
    for (const r of m.reactions ?? []) {
      stmts.push({ sql: "INSERT OR REPLACE INTO reactions VALUES (?,?,?)", args: [m.id, r.emoji, r.me ? r.count - 1 : r.count] });
      if (r.me) stmts.push({ sql: "INSERT OR REPLACE INTO reaction_users VALUES (?,?,?)", args: [m.id, r.emoji, "u_elias"] });
    }
  }
  stmts.push({
    sql: "INSERT OR REPLACE INTO sim_state (id, settings_json, updated_at) VALUES (1, ?, ?)",
    args: [JSON.stringify(DEFAULT_SIM), now],
  });
  await c.batch(stmts, "write");
}

/** Drops all rows and re-seeds (used by `pnpm db:reset`). */
export async function resetDatabase(c: Client) {
  await c.executeMultiple(`
    DELETE FROM reaction_users; DELETE FROM reactions; DELETE FROM messages; DELETE FROM relationships;
    DELETE FROM npc_profiles; DELETE FROM memberships; DELETE FROM channels; DELETE FROM categories;
    DELETE FROM guilds; DELETE FROM users; DELETE FROM sim_state;`);
  await seed(c, Date.now());
}
