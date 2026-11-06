/* Core domain types for The Lounge. Shared by UI, seed script and (later) the sim + DB layer. */

export type Presence = "online" | "idle" | "dnd" | "offline";

export type RoleId = "owner" | "inner" | "regular" | "tourist" | "bot";

export interface Role {
  id: RoleId;
  name: string;
  /** Name colour in chat / member list. null = default text colour. */
  color: string | null;
}

export interface AvatarSpec {
  /** Two gradient stops, generated — never a photo. */
  from: string;
  to: string;
  initials: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarSpec;
  roleId: RoleId;
  /** NPC flag is hidden from regular members (role "NPC" in the spec). */
  isNpc: boolean;
  isBot?: boolean;
  /** Only the real human account(s). NPCs never post as a human. */
  isHuman?: boolean;
  presence: Presence;
  statusText?: string;
  statusEmoji?: string;
  /** Voice state fakes */
  voiceChannelId?: string;
  speaking?: boolean;
  selfMute?: boolean;
  selfDeaf?: boolean;
}

export type EliasOpinion = "fan" | "rival-friend" | "chill" | "skeptic-warm";
export type ActivityCurve = "morning-lurker" | "night-owl" | "always-on" | "evening";

export interface NpcProfile {
  userId: string;
  /** Always 18+ (enforced by the seed validator: 20–34). */
  age: number;
  city: "Hamburg" | "Berlin" | "online" | string;
  district?: string;
  bio: string;
  traits: string[];
  quirks: string[];
  topics: string[];
  eliasOpinion: EliasOpinion;
  activity: ActivityCurve;
  /** 0 = English only … 1 = German only */
  germanRatio: number;
  /** User ids this NPC tends to reply to. */
  relationships: string[];
}

export type ChannelKind = "text" | "voice";

export interface Category {
  id: string;
  guildId: string;
  name: string;
  /** Rendered with the "// " prefix the reference uses for some categories. */
  slashes?: boolean;
  staffOnly?: boolean;
}

export interface Channel {
  id: string;
  guildId: string;
  categoryId: string | null;
  kind: ChannelKind;
  /** Plain slug: "general". Used for "Message #general". */
  name: string;
  /** Optional decoration in the channel list: "# 🍸 // general" */
  emoji?: string;
  topic?: string;
  staffOnly?: boolean;
  /** Seconds between messages for humans, informational in Phase 1. */
  slowmode?: number;
  /** Locked / read-only (lock icon instead of # or speaker) */
  locked?: boolean;
  /** Channel created recently → "NEW" pill */
  isNew?: boolean;
}

export interface Guild {
  id: string;
  name: string;
  /** Short label used where the icon has no image (rail fallback). */
  acronym: string;
  icon: { from: string; to: string; glyph: "lounge" | "lab" | "darkroom" };
  ownerId: string;
  categories: Category[];
  channels: Channel[];
  memberIds: string[];
}

export interface Reaction {
  emoji: string;
  count: number;
  /** Viewer reacted */
  me: boolean;
}

export interface Attachment {
  id: string;
  kind: "image";
  filename: string;
  width: number;
  height: number;
  /** Generated CSS art (gradient stops) instead of real photos. */
  palette: [string, string, string];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: number;
  editedAt?: number;
  replyToId?: string;
  reactions?: Reaction[];
  attachments?: Attachment[];
  isHuman?: boolean;
  /** Seeded/simulated lines carry both languages; the UI language picks one. */
  i18n?: { en: string; de: string };
  /** Simulator bookkeeping (category of the generated line) */
  simTag?: string;
}

export interface ChannelReadState {
  unread: boolean;
  mentions: number;
}

/** Backstage controls for the NPC simulator. */
export interface SimSettings {
  /** 0.25 (sleepy) … 3 (chaos) — multiplier on posting rate */
  activity: number;
  /** 0 (everyone hates you) … 100 (everyone worships you) */
  glaze: number;
  /** 0 (wholesome) … 100 (messy) */
  drama: number;
  /** What they talk about and how they act. */
  prompt: string;
  /** NPCs answer the owner with a language model (needs an AI key — Phase 4). */
  liveReplies: boolean;
  /** NPCs may joke about being simulated. */
  breakCharacter: boolean;
  paused: boolean;
}
