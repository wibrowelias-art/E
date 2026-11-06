import { useId } from "react";
import type { Guild } from "@/lib/types";

/** The Lounge mark: an arched door with a light spill. Original artwork. */
export function LoungeMark({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 21V10.5a6 6 0 0 1 12 0V21"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path d="M9.4 21v-9.6a2.6 2.6 0 0 1 5.2 0V21" fill={color} opacity={0.9} />
      <path d="M3.5 21h17" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export function GuildGlyph({ guild, size }: { guild: Guild; size: number }) {
  const s = size;
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  if (guild.icon.glyph === "lounge") {
    return (
      <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
        <defs>
          <linearGradient id={id("gl-bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d1b22" />
            <stop offset="1" stopColor="#0d0c10" />
          </linearGradient>
          <linearGradient id={id("gl-door")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd88a" />
            <stop offset="1" stopColor="#c98a2b" />
          </linearGradient>
          <radialGradient id={id("gl-glow")} cx="0.5" cy="0.85" r="0.6">
            <stop offset="0" stopColor="#f2c14e" stopOpacity="0.45" />
            <stop offset="1" stopColor="#f2c14e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${id("gl-bg")})`} />
        <rect width="48" height="48" fill={`url(#${id("gl-glow")})`} />
        <path d="M15 40V21a9 9 0 0 1 18 0v19" fill="none" stroke="#f2c14e" strokeWidth="2.4" />
        <path d="M19.5 40V22.5a4.5 4.5 0 0 1 9 0V40Z" fill={`url(#${id("gl-door")})`} />
        <path d="M10 40h28" stroke="#f2c14e" strokeWidth="2.4" strokeLinecap="round" />
        <text x="24" y="12.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fbfbfb" letterSpacing="1.2" fontFamily="inherit">
          GOD
        </text>
      </svg>
    );
  }
  if (guild.icon.glyph === "lab") {
    return (
      <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
        <defs>
          <linearGradient id={id("lab-bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b5876" />
            <stop offset="1" stopColor="#0f1b26" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${id("lab-bg")})`} />
        <path d="M20 11h8M21.5 11v9L13 35.5c-.9 1.7.3 3.5 2.2 3.5h17.6c1.9 0 3.1-1.8 2.2-3.5L26.5 20v-9" fill="none" stroke="#9fe3ff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M16.5 30h15l2.6 5.5c.4.8-.2 1.5-1 1.5H14.9c-.8 0-1.4-.7-1-1.5l2.6-5.5Z" fill="#5fd4ff" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <radialGradient id={id("dk-bg")} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#ff4b3e" />
          <stop offset="0.35" stopColor="#8a1a14" />
          <stop offset="1" stopColor="#140606" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#${id("dk-bg")})`} />
      <rect x="12" y="15" width="24" height="18" rx="3" fill="none" stroke="#ffd2cc" strokeWidth="2.2" />
      <circle cx="24" cy="24" r="5" fill="none" stroke="#ffd2cc" strokeWidth="2.2" />
      <rect x="15" y="12" width="6" height="3" rx="1" fill="#ffd2cc" />
    </svg>
  );
}
