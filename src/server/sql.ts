/**
 * One small database interface over two drivers:
 *  - SQLite / libSQL (local dev `file:./data/lounge.db`, Turso `libsql://…`)
 *  - Postgres (Neon / Vercel Postgres `postgres://…`) via node-postgres
 * Statements use `?` placeholders; the Postgres adapter rewrites them to $1…$n.
 * SQL is written to run on both; the few dialect-specific bits branch on `dialect`.
 */
export type Arg = string | number | bigint | boolean | null;
export type Row = Record<string, unknown>;
export type InStatement = string | { sql: string; args?: Arg[] };

export interface Db {
  dialect: "sqlite" | "pg";
  execute(stmt: InStatement, args?: Arg[]): Promise<{ rows: Row[]; rowsAffected: number }>;
  /** All statements in one transaction. */
  batch(stmts: InStatement[], mode?: "write"): Promise<void>;
  /** Several statements without parameters (schema). */
  executeMultiple(script: string): Promise<void>;
  close(): void;
}

function norm(stmt: InStatement, args?: Arg[]): { sql: string; args: Arg[] } {
  return typeof stmt === "string" ? { sql: stmt, args: args ?? [] } : { sql: stmt.sql, args: stmt.args ?? args ?? [] };
}

/** `?` → `$1…$n`, leaving quoted strings alone. */
export function toPgPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let quoted = false;
  for (const ch of sql) {
    if (ch === "'") quoted = !quoted;
    if (ch === "?" && !quoted) {
      n += 1;
      out += "$" + n;
    } else out += ch;
  }
  return out;
}

export async function openSqlite(url: string, authToken?: string): Promise<Db> {
  // Loaded lazily so Postgres deployments never touch the native SQLite binding.
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url, authToken });
  return {
    dialect: "sqlite",
    async execute(stmt, args) {
      const r = await c.execute(norm(stmt, args) as never);
      return { rows: r.rows as unknown as Row[], rowsAffected: r.rowsAffected };
    },
    async batch(stmts) {
      await c.batch(stmts.map((s) => norm(s)) as never, "write");
    },
    async executeMultiple(script) {
      await c.executeMultiple(script);
    },
    close: () => c.close(),
  };
}

export async function openPostgres(url: string): Promise<Db> {
  const pg = (await import("pg")).default;
  // BIGINT / NUMERIC arrive as strings by default; the app wants numbers (ms timestamps fit).
  pg.types.setTypeParser(20, (v: string) => Number(v));
  pg.types.setTypeParser(1700, (v: string) => Number(v));
  // `channel_binding` is a client-side option some drivers don't know; the server doesn't need it.
  const cleaned = new URL(url);
  cleaned.searchParams.delete("channel_binding");
  const pool = new pg.Pool({ connectionString: cleaned.toString(), max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  pool.on("error", (e: Error) => console.error("[lounge] postgres pool error", e.message));
  return {
    dialect: "pg",
    async execute(stmt, args) {
      const s = norm(stmt, args);
      const r = await pool.query(toPgPlaceholders(s.sql), s.args as unknown[]);
      return { rows: r.rows as Row[], rowsAffected: r.rowCount ?? 0 };
    },
    async batch(stmts) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const stmt of stmts) {
          const s = norm(stmt);
          await client.query(toPgPlaceholders(s.sql), s.args as unknown[]);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async executeMultiple(script) {
      await pool.query(script);
    },
    close: () => {
      void pool.end();
    },
  };
}
