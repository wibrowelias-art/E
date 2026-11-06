import type { Row } from "./sql";
import type { User } from "@/lib/types";

const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

export function rowToUser(r: Row): User {
  return {
    id: String(r.id),
    username: String(r.username),
    displayName: String(r.display_name),
    avatar: { from: String(r.avatar_from), to: String(r.avatar_to), initials: String(r.initials) },
    roleId: String(r.role_id) as User["roleId"],
    isNpc: Number(r.is_npc) === 1,
    isBot: Number(r.is_bot) === 1 || undefined,
    isHuman: Number(r.is_human) === 1 || undefined,
    presence: String(r.presence) as User["presence"],
    statusText: str(r.status_text),
    statusEmoji: str(r.status_emoji),
    voiceChannelId: str(r.voice_channel_id),
    speaking: Number(r.speaking) === 1 || undefined,
    selfMute: Number(r.self_mute) === 1 || undefined,
    selfDeaf: Number(r.self_deaf) === 1 || undefined,
  };
}
