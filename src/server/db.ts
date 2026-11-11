/**
 * Persistence: Postgres (Neon / Vercel Postgres) or libSQL / SQLite.
 *  - local dev:   file:./data/lounge.db (created on first request)
 *  - production:  DATABASE_URL=postgres://… (Neon, pooled) — or libsql://… (Turso)
 *  - Vercel without DATABASE_URL: no database → the app runs in local
 *    (in-browser) mode instead of failing, and Backstage says so.
 * Schema + seed are created on the first request; migrations are additive.
 */
import { mkdirSync } from "node:fs";
import { openPostgres, openSqlite, type Db, type InStatement } from "./sql";
import { GUILDS } from "@/data/guilds";
import { ALL_USERS, NPC_PROFILES } from "@/data/npcs";
import { buildSeed } from "@/data/seed";
import { DEFAULT_SIM } from "@/lib/sim/settings";

export type { Db, InStatement, Row } from "./sql";

export function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Vercel/serverless file systems are read-only → require a hosted database there.
  if (process.env.VERCEL) return null;
  return "file:./data/lounge.db";
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_from TEXT NOT NULL,
  avatar_to TEXT NOT NULL,
  initials TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_npc BIGINT NOT NULL DEFAULT 0,
  is_bot BIGINT NOT NULL DEFAULT 0,
  is_human BIGINT NOT NULL DEFAULT 0,
  presence TEXT NOT NULL DEFAULT 'offline',
  status_text TEXT,
  status_emoji TEXT,
  voice_channel_id TEXT,
  speaking BIGINT NOT NULL DEFAULT 0,
  self_mute BIGINT NOT NULL DEFAULT 0,
  self_deaf BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  rev BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_rev ON users (rev);
CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, name TEXT NOT NULL, acronym TEXT, icon_json TEXT, owner_id TEXT, position BIGINT);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT NOT NULL, slashes BIGINT DEFAULT 0, staff_only BIGINT DEFAULT 0, position BIGINT);
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, category_id TEXT, kind TEXT NOT NULL, name TEXT NOT NULL,
  emoji TEXT, topic TEXT, staff_only BIGINT DEFAULT 0, slowmode BIGINT, locked BIGINT DEFAULT 0, is_new BIGINT DEFAULT 0, position BIGINT
);
CREATE TABLE IF NOT EXISTS memberships (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY (guild_id, user_id));
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_en TEXT,
  content_de TEXT,
  created_at BIGINT NOT NULL,
  edited_at BIGINT,
  reply_to_id TEXT,
  is_human BIGINT NOT NULL DEFAULT 0,
  sim_tag TEXT,
  attachments_json TEXT,
  typing_ms BIGINT NOT NULL DEFAULT 0,
  rev BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_channel_created ON messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS messages_rev ON messages (rev);
CREATE TABLE IF NOT EXISTS reactions (message_id TEXT NOT NULL, emoji TEXT NOT NULL, npc_count BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (message_id, emoji));
CREATE TABLE IF NOT EXISTS reaction_users (message_id TEXT NOT NULL, emoji TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (message_id, emoji, user_id));
CREATE TABLE IF NOT EXISTS npc_profiles (user_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS relationships (from_id TEXT NOT NULL, to_id TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1, PRIMARY KEY (from_id, to_id));
CREATE TABLE IF NOT EXISTS sim_state (
  id BIGINT PRIMARY KEY CHECK (id = 1), settings_json TEXT NOT NULL, updated_at BIGINT NOT NULL,
  state_json TEXT, last_planned_at BIGINT, last_tick_at BIGINT, lease_id TEXT, lease_until BIGINT
);
CREATE TABLE IF NOT EXISTS ai_usage (minute BIGINT PRIMARY KEY, calls BIGINT NOT NULL);
INSERT INTO meta (key, value) VALUES ('rev', 1) ON CONFLICT DO NOTHING;
`;

/** Every write bumps one global revision; clients poll with `since=<rev>`. */
export const BUMP_REV: InStatement = "UPDATE meta SET value = value + 1 WHERE key = 'rev'";
export const CURRENT_REV = "(SELECT value FROM meta WHERE key = 'rev')";

let ready: Promise<Db | null> | null = null;
export let persistenceError: string | null = null;

/** Resolves to a ready database, or null when none is configured / reachable. */
export function db(): Promise<Db | null> {
  ready ??= init();
  return ready;
}

export async function openDatabase(url: string): Promise<Db> {
  if (/^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
  const c = await openSqlite(url, process.env.DATABASE_AUTH_TOKEN || undefined);
  if (url.startsWith("file:")) await c.execute("PRAGMA journal_mode = WAL");
  return c;
}

async function init(): Promise<Db | null> {
  const url = databaseUrl();
  if (!url) return null;
  try {
    const client = await openDatabase(url);
    await prepare(client);
    return client;
  } catch (e) {
    persistenceError = e instanceof Error ? e.message : String(e);
    console.error("[lounge] database unavailable, falling back to local mode:", persistenceError);
    ready = null; // retry on the next request
    return null;
  }
}

/** Schema, additive migrations and first-run seed. Safe to run on every cold start. */
export async function prepare(c: Db) {
  await c.executeMultiple(SCHEMA);
  await migrate(c);
  await seedIfEmpty(c);
}

/** Additive migrations for databases created by earlier phases. */
async function migrate(c: Db) {
  const columns: Array<[string, string, string]> = [
    // Phase 3: server floor — typing time before a scheduled message becomes visible
    ["messages", "typing_ms", "BIGINT NOT NULL DEFAULT 0"],
    ["reactions", "created_at", "BIGINT NOT NULL DEFAULT 0"],
    ["sim_state", "state_json", "TEXT"],
    ["sim_state", "last_planned_at", "BIGINT"],
    ["sim_state", "last_tick_at", "BIGINT"],
    ["sim_state", "lease_id", "TEXT"],
    ["sim_state", "lease_until", "BIGINT"],
  ];
  if (c.dialect === "pg") {
    for (const [table, col, def] of columns) await c.execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
  } else {
    const have = new Map<string, Set<string>>();
    for (const [table, col, def] of columns) {
      if (!have.has(table)) have.set(table, new Set((await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name))));
      if (!have.get(table)!.has(col)) await c.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    }
  }
  await c.execute("CREATE INDEX IF NOT EXISTS messages_created ON messages (created_at)");
  await c.execute("CREATE INDEX IF NOT EXISTS reactions_created ON reactions (created_at)");
}

async function seedIfEmpty(c: Db) {
  const r = await c.execute("SELECT COUNT(*) AS n FROM users");
  if (Number(r.rows[0]?.n ?? 0) > 0) return;
  await seed(c, Date.now());
}

/** Writes guilds, channels, cast, relationships and the backlog. */
export async function seed(c: Db, now: number) {
  const snap = buildSeed(now);
  const stmts: InStatement[] = [BUMP_REV];
  for (const u of ALL_USERS) {
    stmts.push({
      sql: `INSERT INTO users (id, username, display_name, avatar_from, avatar_to, initials, role_id, is_npc, is_bot, is_human,
            presence, status_text, status_emoji, voice_channel_id, speaking, self_mute, self_deaf, created_at, rev)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,${CURRENT_REV}) ON CONFLICT DO NOTHING`,
      args: [
        u.id, u.username, u.displayName, u.avatar.from, u.avatar.to, u.avatar.initials, u.roleId,
        u.isNpc ? 1 : 0, u.isBot ? 1 : 0, u.isHuman ? 1 : 0, u.presence, u.statusText ?? null, u.statusEmoji ?? null,
        u.voiceChannelId ?? null, u.speaking ? 1 : 0, u.selfMute ? 1 : 0, u.selfDeaf ? 1 : 0, now,
      ],
    });
  }
  GUILDS.forEach((g, gi) => {
    stmts.push({ sql: "INSERT INTO guilds (id, name, acronym, icon_json, owner_id, position) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING", args: [g.id, g.name, g.acronym, JSON.stringify(g.icon), g.ownerId, gi] });
    g.categories.forEach((k, i) =>
      stmts.push({ sql: "INSERT INTO categories (id, guild_id, name, slashes, staff_only, position) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING", args: [k.id, g.id, k.name, k.slashes ? 1 : 0, k.staffOnly ? 1 : 0, i] }),
    );
    g.channels.forEach((ch, i) =>
      stmts.push({
        sql: "INSERT INTO channels (id, guild_id, category_id, kind, name, emoji, topic, staff_only, slowmode, locked, is_new, position) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        args: [ch.id, g.id, ch.categoryId, ch.kind, ch.name, ch.emoji ?? null, ch.topic ?? null, ch.staffOnly ? 1 : 0, ch.slowmode ?? null, ch.locked ? 1 : 0, ch.isNew ? 1 : 0, i],
      }),
    );
    for (const uid of g.memberIds) {
      const u = ALL_USERS.find((x) => x.id === uid);
      stmts.push({ sql: "INSERT INTO memberships (guild_id, user_id, role_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", args: [g.id, uid, u?.roleId ?? "regular"] });
    }
  });
  for (const p of NPC_PROFILES) {
    stmts.push({ sql: "INSERT INTO npc_profiles (user_id, profile_json) VALUES (?,?) ON CONFLICT DO NOTHING", args: [p.userId, JSON.stringify(p)] });
    for (const to of p.relationships) stmts.push({ sql: "INSERT INTO relationships (from_id, to_id, weight) VALUES (?,?,1) ON CONFLICT DO NOTHING", args: [p.userId, to] });
  }
  for (const m of snap.messages) {
    stmts.push({
      sql: `INSERT INTO messages (id, channel_id, author_id, content, content_en, content_de, created_at, edited_at, reply_to_id, is_human, sim_tag, attachments_json, rev)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,${CURRENT_REV}) ON CONFLICT DO NOTHING`,
      args: [
        m.id, m.channelId, m.authorId, m.content, m.i18n?.en ?? null, m.i18n?.de ?? null, m.createdAt, m.editedAt ?? null,
        m.replyToId ?? null, m.isHuman ? 1 : 0, m.simTag ?? null, m.attachments ? JSON.stringify(m.attachments) : null,
      ],
    });
    for (const r of m.reactions ?? []) {
      stmts.push({
        sql: "INSERT INTO reactions (message_id, emoji, npc_count, created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
        args: [m.id, r.emoji, r.me ? r.count - 1 : r.count, m.createdAt],
      });
      if (r.me) stmts.push({ sql: "INSERT INTO reaction_users (message_id, emoji, user_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", args: [m.id, r.emoji, "u_elias"] });
    }
  }
  stmts.push({
    sql: "INSERT INTO sim_state (id, settings_json, updated_at) VALUES (1, ?, ?) ON CONFLICT DO NOTHING",
    args: [JSON.stringify(DEFAULT_SIM), now],
  });
  await c.batch(stmts, "write");
}

/** Drops all rows and re-seeds (used by `pnpm db:reset`). */
export async function resetDatabase(c: Db) {
  await c.executeMultiple(`
    DELETE FROM reaction_users; DELETE FROM reactions; DELETE FROM messages; DELETE FROM relationships;
    DELETE FROM npc_profiles; DELETE FROM memberships; DELETE FROM channels; DELETE FROM categories;
    DELETE FROM guilds; DELETE FROM users; DELETE FROM sim_state; DELETE FROM ai_usage;`);
  await seed(c, Date.now());
}
