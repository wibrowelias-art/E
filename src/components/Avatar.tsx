import type { Presence, User } from "@/lib/types";

const STATUS_COLOR: Record<Presence, string> = {
  online: "var(--status-online)",
  idle: "var(--status-idle)",
  dnd: "var(--status-dnd)",
  offline: "var(--status-offline)",
};

export function StatusGlyph({ presence, size, ring }: { presence: Presence; size: number; ring: string }) {
  // size = dot diameter; ring = colour of the cut-out ring (the surface behind the avatar)
  const r = size / 2;
  const color = STATUS_COLOR[presence];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={r} cy={r} r={r} fill={color} />
      {presence === "idle" && <circle cx={r * 0.55} cy={r * 0.55} r={r * 0.62} fill={ring} />}
      {presence === "dnd" && <rect x={r * 0.45} y={r * 0.8} width={r * 1.1} height={r * 0.4} rx={r * 0.2} fill={ring} />}
      {presence === "offline" && <circle cx={r} cy={r} r={r * 0.45} fill={ring} />}
    </svg>
  );
}

interface AvatarProps {
  user: Pick<User, "avatar" | "displayName" | "presence">;
  size: number;
  /** Show the presence dot. */
  status?: boolean;
  /** Dot diameter override. */
  dot?: number;
  /** Colour of the surface the avatar sits on (cut-out ring). */
  ring?: string;
  speaking?: boolean;
  className?: string;
}

export function Avatar({ user, size, status, dot, ring = "var(--bg-base-low)", speaking, className }: AvatarProps) {
  const dotSize = dot ?? Math.max(8, Math.round(size * 0.3));
  const ringW = Math.max(2, Math.round(size * 0.09));
  const fontSize = Math.round(size * 0.42);
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ""}`} style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full select-none items-center justify-center rounded-full font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${user.avatar.from}, ${user.avatar.to})`,
          fontSize,
          letterSpacing: "-0.01em",
          boxShadow: speaking ? `0 0 0 2px var(--status-online), 0 0 0 4px ${ring}` : undefined,
          textShadow: "0 1px 2px rgba(0,0,0,.25)",
        }}
      >
        {user.avatar.initials}
      </span>
      {status && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: dotSize + ringW * 2,
            height: dotSize + ringW * 2,
            right: -ringW,
            bottom: -ringW,
            background: ring,
          }}
        >
          <StatusGlyph presence={user.presence} size={dotSize} ring={ring} />
        </span>
      )}
    </span>
  );
}
