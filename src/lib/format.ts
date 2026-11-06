/* Time + grouping helpers (24h, Hamburg style). */

const pad = (n: number) => n.toString().padStart(2, "0");

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Locale-aware short time: "16:40" (de) / "4:40 PM" (en-US), like the reference. */
export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Mobile header time: today → time only (reference), otherwise "Yesterday at …" / date. */
export function shortHeaderTime(ms: number, now: number): string {
  const diff = dayDiff(ms, now);
  if (diff === 0) return clock(ms);
  return headerTime(ms, now);
}

export function dayDiff(ms: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
}

/** Header timestamp next to a name: "Today at 16:02", "Yesterday at 23:41", "03/11/2026 14:00" */
export function headerTime(ms: number, now: number): string {
  const diff = dayDiff(ms, now);
  if (diff === 0) return `Today at ${clock(ms)}`;
  if (diff === 1) return `Yesterday at ${clock(ms)}`;
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${clock(ms)}`;
}

export function fullDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Date divider label: "6 November 2026" (Discord shows the full date). */
export function dividerDate(ms: number): string {
  return fullDate(ms);
}

export function fullTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Messages from the same author within 7 minutes collapse into one group. */
export const GROUP_WINDOW_MS = 7 * 60_000;
