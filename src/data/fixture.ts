import type { Category, Channel } from "@/lib/types";

/**
 * `?fixture=ref` — a Lounge channel list with the same *row structure* as the
 * reference screenshot (2 locked rows, 3 categories, selection on the 6th
 * text row, three unread rows, one NEW pill, three voice rows). Used only by
 * the comparison loop so every row can be overlaid 1:1. Names/emoji are ours.
 */
const G = "g_lounge";

export const FIXTURE_CATEGORIES: Category[] = [
  { id: "fx_lobby", guildId: G, name: "lobby", slashes: true },
  { id: "fx_floors", guildId: G, name: "Floors" },
  { id: "fx_community", guildId: G, name: "Community" },
  { id: "fx_voice", guildId: G, name: "Voice" },
];

export const FIXTURE_CHANNELS: Channel[] = [
  { id: "fx_online", guildId: G, categoryId: null, kind: "voice", name: "Online : 31", locked: true },
  { id: "fx_brand", guildId: G, categoryId: null, kind: "voice", name: "/TheLounge", locked: true },
  { id: "fx_welcome", guildId: G, categoryId: "fx_lobby", kind: "text", name: "welcome", emoji: "🚪" },
  { id: "fx_intros", guildId: G, categoryId: "fx_lobby", kind: "text", name: "intros", emoji: "📷" },
  { id: "fx_general", guildId: G, categoryId: "fx_floors", kind: "text", name: "general", emoji: "🎫" },
  { id: "fx_news", guildId: G, categoryId: "fx_community", kind: "text", name: "announcements", emoji: "🔔" },
  { id: "fx_glaze", guildId: G, categoryId: "fx_community", kind: "text", name: "glaze", emoji: "👑", isNew: true },
  { id: "fx_photo", guildId: G, categoryId: "fx_community", kind: "text", name: "photos", emoji: "📷" },
  { id: "fx_build", guildId: G, categoryId: "fx_community", kind: "text", name: "build", emoji: "💻" },
  { id: "fx_vc1", guildId: G, categoryId: "fx_voice", kind: "voice", name: "Lounge 1" },
  { id: "fx_vc2", guildId: G, categoryId: "fx_voice", kind: "voice", name: "Lounge 2" },
  { id: "fx_vc3", guildId: G, categoryId: "fx_voice", kind: "voice", name: "Lounge 3" },
];

export const FIXTURE_SELECTED = "fx_news";
export const FIXTURE_UNREAD = new Set(["fx_glaze", "fx_photo", "fx_build"]);

/**
 * `?fixture=ref` in a chat — same message structure as the chat reference
 * (own 1-liner, other 2 grouped, own, other, own) so rows overlay 1:1.
 */
export function fixtureMessages(channelId: string, now: number) {
  const t = now - 60_000;
  const m = (i: number, authorId: string, content: string) => ({
    id: `fx_m${i}`,
    channelId,
    authorId,
    content,
    createdAt: t + i * 1000,
    isHuman: authorId === "u_elias",
  });
  return [
    m(0, "u_elias", "yo"),
    m(1, "u_mara", "was geht"),
    m(2, "u_mara", "Hru"),
    m(3, "u_elias", "Gut"),
    m(4, "u_mara", "Gut danke"),
    m(5, "u_elias", "u"),
  ];
}
