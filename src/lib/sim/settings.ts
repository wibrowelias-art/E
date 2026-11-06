import type { SimSettings } from "@/lib/types";

/** The normal Lounge vibe: busy but readable, mostly warm with light roasting, low drama. */
export const DEFAULT_SIM: SimSettings = {
  activity: 1,
  glaze: 65,
  drama: 20,
  prompt:
    "Talk about plans for tonight, film photos, music, food and Elias' latest drops. Be friendly, a little teasing, specific with compliments.",
  liveReplies: false,
  breakCharacter: false,
  paused: false,
  muted: [],
};

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  values: Pick<SimSettings, "activity" | "glaze" | "drama" | "prompt">;
}

export const PRESETS: Preset[] = [
  {
    id: "default",
    name: "Default vibe",
    blurb: "Busy floor, warm, light roasting",
    values: { activity: DEFAULT_SIM.activity, glaze: DEFAULT_SIM.glaze, drama: DEFAULT_SIM.drama, prompt: DEFAULT_SIM.prompt },
  },
  {
    id: "sunday",
    name: "Wholesome Sunday",
    blurb: "Slow, kind, brunch talk",
    values: {
      activity: 0.5,
      glaze: 80,
      drama: 5,
      prompt: "Talk about brunch, the Alster run, film scans and lazy Sunday plans. Be kind and calm.",
    },
  },
  {
    id: "afterhours",
    name: "Afterhours chaos",
    blurb: "3am, everyone is still out",
    values: {
      activity: 2.6,
      glaze: 60,
      drama: 55,
      prompt: "Talk about the afterparty, the last bahn, späti runs and who went home with whom. Be hyped and loud.",
    },
  },
  {
    id: "roast",
    name: "Roast night",
    blurb: "Everyone roasts the owner",
    values: {
      activity: 1.6,
      glaze: 15,
      drama: 40,
      prompt: "Talk about Elias' latest drop and the vlog that never came. Be sarcastic and roast him, playful not mean.",
    },
  },
];

export const SIM_STORAGE_KEY = "lounge.sim";

export function clampSettings(s: Partial<SimSettings>): SimSettings {
  const n = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  return {
    activity: n(s.activity, 0.25, 3, DEFAULT_SIM.activity),
    glaze: n(s.glaze, 0, 100, DEFAULT_SIM.glaze),
    drama: n(s.drama, 0, 100, DEFAULT_SIM.drama),
    prompt: typeof s.prompt === "string" ? s.prompt.slice(0, 600) : DEFAULT_SIM.prompt,
    liveReplies: !!s.liveReplies,
    breakCharacter: !!s.breakCharacter,
    paused: !!s.paused,
    muted: Array.isArray(s.muted) ? s.muted.filter((id): id is string => typeof id === "string" && /^u_[a-z0-9_]+$/.test(id)).slice(0, 40) : [],
  };
}

export function matchesPreset(s: SimSettings, p: Preset): boolean {
  return (
    Math.abs(s.activity - p.values.activity) < 0.001 &&
    s.glaze === p.values.glaze &&
    s.drama === p.values.drama &&
    s.prompt.trim() === p.values.prompt.trim()
  );
}
