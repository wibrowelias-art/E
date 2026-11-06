import type { Category, Channel, Guild } from "@/lib/types";
import { ALL_USERS, BOT_ID, OWNER_ID } from "./npcs";

export const LOUNGE_ID = "g_lounge";
export const LAB_ID = "g_lab";
export const DARKROOM_ID = "g_darkroom";

const loungeCategories: Category[] = [
  { id: "k_lobby", guildId: LOUNGE_ID, name: "lobby", slashes: true },
  { id: "k_floors", guildId: LOUNGE_ID, name: "floors", slashes: true },
  { id: "k_voice", guildId: LOUNGE_ID, name: "Voice" },
  { id: "k_staff", guildId: LOUNGE_ID, name: "Staff", staffOnly: true },
];

const t = (
  id: string,
  categoryId: string,
  name: string,
  emoji: string,
  topic: string,
  extra: Partial<Channel> = {},
): Channel => ({ id, guildId: LOUNGE_ID, categoryId, kind: "text", name, emoji, topic, ...extra });

const v = (id: string, name: string): Channel => ({
  id,
  guildId: LOUNGE_ID,
  categoryId: "k_voice",
  kind: "voice",
  name,
});

const loungeChannels: Channel[] = [
  t("c_welcome", "k_lobby", "welcome", "🚪", "House rules. Read them once, live them always.", { slowmode: 3600 }),
  t("c_intros", "k_lobby", "introductions", "👋", "Name, city, what got you through the door."),
  t("c_general", "k_floors", "general", "🍸", "Main floor. Be loud, be kind."),
  t("c_glaze", "k_floors", "glaze", "✨", "Specific praise only. 'king' alone gets you a timeout."),
  t("c_hhnight", "k_floors", "hamburg-night", "🌃", "Where we're going, who's on the list, which späti is still open."),
  t("c_photo", "k_floors", "photo-dump", "📷", "Shots from the night. Film, digital, potato — all welcome.", { isNew: true }),
  t("c_build", "k_floors", "build-in-public", "🛠️", "IMAGEFORGE, SPOTLY, the learning app and everything half-finished."),
  t("c_random", "k_floors", "random", "🎲", "Anything that doesn't fit anywhere else."),
  t("c_memes", "k_floors", "memes", "🐸", "Quality over quantity. Lies."),
  v("c_vc_main", "Lounge Main"),
  v("c_vc_after", "Afterhours"),
  v("c_vc_afk", "AFK"),
  t("c_ops", "k_staff", "ops", "🛡️", "Owner tools: simulation controls, bursts, mutes.", { staffOnly: true }),
  t("c_npcdebug", "k_staff", "npc-debug", "🧪", "Last prompts, last responses, uniqueness rejects.", { staffOnly: true }),
];

const labCategories: Category[] = [{ id: "k_lab", guildId: LAB_ID, name: "Lab" }];
const labChannels: Channel[] = [
  { id: "c_lab_roadmap", guildId: LAB_ID, categoryId: "k_lab", kind: "text", name: "roadmap", emoji: "🗺️", topic: "What ships next." },
  { id: "c_lab_feedback", guildId: LAB_ID, categoryId: "k_lab", kind: "text", name: "feedback", emoji: "💬", topic: "Be honest, be specific." },
];

const darkCategories: Category[] = [{ id: "k_dark", guildId: DARKROOM_ID, name: "Darkroom" }];
const darkChannels: Channel[] = [
  { id: "c_dark_main", guildId: DARKROOM_ID, categoryId: "k_dark", kind: "text", name: "darkroom", emoji: "🎞️", topic: "Film only." },
];

const everyone = ALL_USERS.map((u) => u.id);

export const GUILDS: Guild[] = [
  {
    id: LOUNGE_ID,
    name: "GOD // THE LOUNGE",
    acronym: "GL",
    icon: { from: "#17161b", to: "#3b2b12", glyph: "lounge" },
    ownerId: OWNER_ID,
    categories: loungeCategories,
    channels: loungeChannels,
    memberIds: everyone,
  },
  {
    id: LAB_ID,
    name: "Elias Lab",
    acronym: "EL",
    icon: { from: "#1f3b4d", to: "#0e1a24", glyph: "lab" },
    ownerId: OWNER_ID,
    categories: labCategories,
    channels: labChannels,
    memberIds: [OWNER_ID, BOT_ID, "u_jonas", "u_noor", "u_emil", "u_jasper", "u_sofia", "u_clara"],
  },
  {
    id: DARKROOM_ID,
    name: "Darkroom Club",
    acronym: "DC",
    icon: { from: "#3d1d1d", to: "#120909", glyph: "darkroom" },
    ownerId: "u_ida",
    categories: darkCategories,
    channels: darkChannels,
    memberIds: [OWNER_ID, "u_ida", "u_hanna", "u_oskar", "u_rosa", "u_theo"],
  },
];

export const DEFAULT_GUILD_ID = LOUNGE_ID;
export const DEFAULT_CHANNEL_ID = "c_general";

export function findGuild(id: string): Guild | undefined {
  return GUILDS.find((g) => g.id === id);
}

/** URL slugs: /channels/lounge/general */
export const GUILD_SLUGS: Record<string, string> = { lounge: LOUNGE_ID, lab: LAB_ID, darkroom: DARKROOM_ID };
export const GUILD_SLUG_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(GUILD_SLUGS).map(([slug, id]) => [id, slug]),
);
