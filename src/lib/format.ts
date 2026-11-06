/* Time + grouping helpers. Locale follows the UI language (en-US / de-DE). */
import { STRINGS, type Lang } from "./i18n";

const pad = (n: number) => n.toString().padStart(2, "0");

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayDiff(ms: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
}

/** Short time: "4:40 PM" (en, like the reference) / "16:40" (de). */
export function clock(ms: number, lang: Lang = "en"): string {
  return new Date(ms).toLocaleTimeString(STRINGS[lang].locale, { hour: "numeric", minute: "2-digit" });
}

/** Desktop header: "Today at 4:40 PM", "Yesterday at …", "03/11/2026 4:40 PM" */
export function headerTime(ms: number, now: number, lang: Lang = "en"): string {
  const t = STRINGS[lang];
  const diff = dayDiff(ms, now);
  if (diff === 0) return `${t.today} ${clock(ms, lang)}`;
  if (diff === 1) return `${t.yesterday} ${clock(ms, lang)}`;
  const d = new Date(ms);
  const date = lang === "de" ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  return `${date} ${clock(ms, lang)}`;
}

/** Mobile header (reference): today → time only, otherwise like desktop. */
export function shortHeaderTime(ms: number, now: number, lang: Lang = "en"): string {
  return dayDiff(ms, now) === 0 ? clock(ms, lang) : headerTime(ms, now, lang);
}

/** Date divider: "November 6, 2026" / "6. November 2026" */
export function dividerDate(ms: number, lang: Lang = "en"): string {
  return new Date(ms).toLocaleDateString(STRINGS[lang].locale, { day: "numeric", month: "long", year: "numeric" });
}

export function fullTimestamp(ms: number, lang: Lang = "en"): string {
  return new Date(ms).toLocaleString(STRINGS[lang].locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Messages from the same author within 7 minutes collapse into one group. */
export const GROUP_WINDOW_MS = 7 * 60_000;
