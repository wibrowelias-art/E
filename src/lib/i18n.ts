/* UI language. "en" = everything in English (default).
 * "de" = German UI and the original Hamburg German/English chat mix. */

export type Lang = "en" | "de";

export const LANGS: Array<{ id: Lang; label: string; hint: string }> = [
  { id: "en", label: "English", hint: "Interface and chat in English" },
  { id: "de", label: "Deutsch", hint: "Oberfläche auf Deutsch, Chat im Hamburger Deutsch-Englisch-Mix" },
];

const en = {
  locale: "en-US",
  members: (n: string) => `${n} Members`,
  community: "Community",
  search: "Search",
  searchGuild: (g: string) => `Search ${g}`,
  newPill: "NEW",
  presence: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Invisible" },
  presenceOther: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" },
  messagePlaceholder: (c: string) => `Message #${c}`,
  replyingTo: "Replying to",
  typing1: " is typing…",
  typing2: " are typing…",
  typingN: (n: number) => ` and ${n} others are typing…`,
  typingMany: "Several people are typing…",
  and: " and ",
  welcome: (c: string) => `Welcome to #${c}!`,
  startOf: (c: string): [string, string, string] => ["This is the start of the ", `#${c}`, " channel."],
  olderMessages: "You're viewing older messages",
  jumpToPresent: "Jump to present",
  today: "Today at",
  yesterday: "Yesterday at",
  edited: "(edited)",
  editHint: ["escape to ", "cancel", " • enter to ", "save"] as [string, string, string, string],
  inVoice: "In voice",
  online: "Online",
  offline: "Offline",
  inChannel: (c: string) => `In ${c}`,
  aboutMe: "About me",
  basedIn: "Based in",
  roles: "Roles",
  ownerAbout: "Hamburg. Photography, night culture, building apps. Owner of The Lounge.",
  settings: "Settings",
  language: "Language",
  backstage: "Backstage",
  backstageHint: "Vibe, chaos, glaze and drama controls",
  serverOwner: "Server owner",
};

export type Strings = typeof en;

const de: Strings = {
  locale: "de-DE",
  members: (n) => `${n} Mitglieder`,
  community: "Community",
  search: "Suchen",
  searchGuild: (g) => `${g} durchsuchen`,
  newPill: "NEU",
  presence: { online: "Online", idle: "Abwesend", dnd: "Bitte nicht stören", offline: "Unsichtbar" },
  presenceOther: { online: "Online", idle: "Abwesend", dnd: "Bitte nicht stören", offline: "Offline" },
  messagePlaceholder: (c) => `Nachricht an #${c}`,
  replyingTo: "Antwort an",
  typing1: " schreibt …",
  typing2: " schreiben …",
  typingN: (n) => ` und ${n} weitere schreiben …`,
  typingMany: "Mehrere Leute schreiben …",
  and: " und ",
  welcome: (c) => `Willkommen in #${c}!`,
  startOf: (c) => ["Das ist der Anfang des Kanals ", `#${c}`, "."],
  olderMessages: "Du siehst ältere Nachrichten",
  jumpToPresent: "Zur Gegenwart springen",
  today: "Heute um",
  yesterday: "Gestern um",
  edited: "(bearbeitet)",
  editHint: ["Escape zum ", "Abbrechen", " • Enter zum ", "Speichern"],
  inVoice: "Im Sprachkanal",
  online: "Online",
  offline: "Offline",
  inChannel: (c) => `In ${c}`,
  aboutMe: "Über mich",
  basedIn: "Wohnort",
  roles: "Rollen",
  ownerAbout: "Hamburg. Fotografie, Nachtkultur, Apps bauen. Inhaber von The Lounge.",
  settings: "Einstellungen",
  language: "Sprache",
  backstage: "Backstage",
  backstageHint: "Vibe, Chaos, Glaze und Drama einstellen",
  serverOwner: "Serverinhaber",
};

export const STRINGS: Record<Lang, Strings> = { en, de };

export const LANG_STORAGE_KEY = "lounge.lang";
