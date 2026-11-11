/**
 * Image / GIF uploads. The browser resizes photos before sending (GIFs are sent as-is
 * so they keep animating); the bytes live in the database and are served from
 * /api/uploads/<id> with a long cache lifetime.
 */
import { randomBytes } from "node:crypto";
import type { Attachment } from "@/lib/types";
import type { Session } from "./auth";
import type { Db } from "./sql";
import { ApiError } from "./repo";

export const MAX_UPLOAD_BYTES = 2_600_000;
const MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const buckets = new Map<string, number[]>();

function uploadRate(s: Session) {
  const now = Date.now();
  const max = s.role === "owner" ? 20 : 4;
  const list = (buckets.get(s.uid) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= max) throw new ApiError(429, "Too many uploads — wait a minute.");
  list.push(now);
  buckets.set(s.uid, list);
}

/** Checks the real file signature, not just what the browser claimed. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function createUpload(c: Db, s: Session, body: { data?: unknown; filename?: unknown; width?: unknown; height?: unknown }) {
  if (typeof body.data !== "string") throw new ApiError(400, "No file.");
  const m = body.data.match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new ApiError(400, "Unreadable file.");
  const buf = Buffer.from(m[2]!, "base64");
  if (buf.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "That file is too big (max 2.5 MB).");
  const mime = sniff(buf);
  if (!mime || !MIME.has(mime)) throw new ApiError(415, "Only PNG, JPEG, WebP and GIF images.");
  uploadRate(s);
  const width = Math.max(1, Math.min(10_000, Math.round(Number(body.width) || 0))) || 400;
  const height = Math.max(1, Math.min(10_000, Math.round(Number(body.height) || 0))) || 300;
  const filename = (typeof body.filename === "string" ? body.filename : "image").replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "image";
  const id = `up_${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
  await c.execute({
    sql: "INSERT INTO uploads (id, owner_id, mime, filename, width, height, size, data, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [id, s.uid, mime, filename, width, height, buf.length, buf.toString("base64"), Date.now()],
  });
  const attachment: Attachment = { id, kind: "image", filename, width, height, mime, url: `/api/uploads/${id}` };
  return { attachment };
}

export async function readUpload(c: Db, id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^up_[a-z0-9]+$/.test(id)) return null;
  const r = await c.execute({ sql: "SELECT mime, data FROM uploads WHERE id = ?", args: [id] });
  const row = r.rows[0];
  if (!row) return null;
  return { mime: String(row.mime), bytes: Buffer.from(String(row.data), "base64") };
}

/** Attachments a message may carry: only your own uploads, max 4. */
export async function resolveAttachments(c: Db, s: Session, raw: unknown): Promise<Attachment[]> {
  if (!Array.isArray(raw) || !raw.length) return [];
  const ids = raw
    .map((a) => (a && typeof a === "object" ? String((a as { id?: unknown }).id ?? "") : ""))
    .filter((id) => /^up_[a-z0-9]+$/.test(id))
    .slice(0, 4);
  if (!ids.length) return [];
  const r = await c.execute({
    sql: `SELECT id, mime, filename, width, height FROM uploads WHERE owner_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
    args: [s.uid, ...ids],
  });
  const byId = new Map(r.rows.map((row) => [String(row.id), row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => !!row)
    .map((row) => ({
      id: String(row.id),
      kind: "image" as const,
      filename: String(row.filename),
      width: Number(row.width),
      height: Number(row.height),
      mime: String(row.mime),
      url: `/api/uploads/${String(row.id)}`,
    }));
}
