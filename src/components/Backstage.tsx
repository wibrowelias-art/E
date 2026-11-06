"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { GUILDS } from "@/data/guilds";
import { LANGS, type Lang } from "@/lib/i18n";
import { parsePrompt } from "@/lib/sim/brain";
import { DEFAULT_SIM, matchesPreset, PRESETS } from "@/lib/sim/settings";
import { useLounge } from "@/lib/store";
import { CloseIcon } from "./icons";

/** Backstage copy (owner tool) in both UI languages. */
const COPY = {
  en: {
    title: "Backstage",
    sub: "Shape how the floor behaves. Changes apply live and are saved on this device.",
    presets: "Presets",
    world: "World",
    activity: "World activity",
    sleepy: "sleepy",
    chaos: "chaos",
    glaze: "Glaze ratio",
    hates: "everyone hates you",
    worships: "everyone worships you",
    drama: "Drama level",
    wholesome: "wholesome",
    messy: "messy",
    vibe: "Vibe prompt",
    vibeLabel: "What do they talk about, and how should they act?",
    vibeHelp:
      "Without an AI key, the topics and tone words in this prompt steer the built-in lines (e.g. “talk about tonight's drop”, “be hyped”). Once an AI provider is connected (Phase 4) the whole prompt goes into every NPC's instructions.",
    topics: "Topics",
    tone: "Tone",
    none: "none detected",
    conversations: "Conversations",
    live: "Live replies",
    liveDesc:
      "When you talk to someone, they write a new reply with a language model on the server, using the recent chat. Off: built-in lines only. Needs an AI key — arrives in Phase 4.",
    breakChar: "Let people break character",
    breakCharDesc: "Now and then someone jokes that they might be simulated. Off: everyone stays in character.",
    running: "Floor is live",
    runningDesc: "NPCs keep posting, reacting, typing and hopping in and out of voice. Off: everything freezes.",
    burst: (c: string) => `Start a burst in #${c}`,
    language: "Language",
    feed: "Live feed",
    feedEmpty: "Nothing yet — the first lines appear within a few seconds.",
    reset: "Reset everything to the default vibe",
    active: "active",
    in: "in",
  },
  de: {
    title: "Backstage",
    sub: "Bestimme, wie sich der Floor verhält. Änderungen wirken sofort und bleiben auf diesem Gerät gespeichert.",
    presets: "Vorlagen",
    world: "Welt",
    activity: "Aktivität",
    sleepy: "verschlafen",
    chaos: "Chaos",
    glaze: "Glaze-Anteil",
    hates: "alle hassen dich",
    worships: "alle vergöttern dich",
    drama: "Drama-Level",
    wholesome: "harmonisch",
    messy: "chaotisch",
    vibe: "Vibe-Prompt",
    vibeLabel: "Worüber reden sie, und wie sollen sie sich verhalten?",
    vibeHelp:
      "Ohne KI-Schlüssel steuern Themen und Tonwörter aus diesem Prompt die eingebauten Sätze (z. B. „redet über den Drop heute“, „seid aufgedreht“). Mit verbundenem KI-Anbieter (Phase 4) landet der ganze Prompt in den Anweisungen jeder Figur.",
    topics: "Themen",
    tone: "Ton",
    none: "nichts erkannt",
    conversations: "Gespräche",
    live: "Live-Antworten",
    liveDesc:
      "Wenn du jemanden ansprichst, schreibt die Person mit einem Sprachmodell auf dem Server eine neue Antwort aus dem aktuellen Chat. Aus: nur eingebaute Sätze. Braucht einen KI-Schlüssel — kommt in Phase 4.",
    breakChar: "Aus der Rolle fallen erlauben",
    breakCharDesc: "Ab und zu witzelt jemand, dass er vielleicht simuliert ist. Aus: alle bleiben in ihrer Rolle.",
    running: "Floor ist live",
    runningDesc: "NPCs posten, reagieren, tippen und springen in Sprachkanäle. Aus: alles friert ein.",
    burst: (c: string) => `Welle in #${c} starten`,
    language: "Sprache",
    feed: "Live-Feed",
    feedEmpty: "Noch nichts — die ersten Nachrichten kommen in ein paar Sekunden.",
    reset: "Alles auf den Standard-Vibe zurücksetzen",
    active: "aktiv",
    in: "in",
  },
} satisfies Record<Lang, Record<string, unknown>>;

const PRESET_DE: Record<string, [string, string]> = {
  default: ["Standard-Vibe", "Voller Floor, herzlich, leicht frech"],
  sunday: ["Gemütlicher Sonntag", "Langsam, lieb, Brunch-Talk"],
  afterhours: ["Afterhours-Chaos", "3 Uhr, alle noch unterwegs"],
  roast: ["Roast-Abend", "Alle roasten den Inhaber"],
};

function Slider(props: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  left: string;
  right: string;
  onChange: (v: number) => void;
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <div className="bs-slider">
      <div className="bs-slider__head">
        <label className="bs-slider__label">{props.label}</label>
        <output className="bs-slider__value">{props.display}</output>
      </div>
      <input
        type="range"
        className="bs-range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-label={props.label}
        aria-valuetext={props.display}
        style={{ "--pct": `${pct}%` } as CSSProperties}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <div className="bs-slider__ends">
        <span>{props.left}</span>
        <span>{props.right}</span>
      </div>
    </div>
  );
}

function Check(props: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="bs-check" data-disabled={props.disabled}>
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>
        <span className="bs-check__label">{props.label}</span>
        <span className="bs-check__desc">{props.desc}</span>
      </span>
    </label>
  );
}

export function Backstage() {
  const open = useLounge((s) => s.backstageOpen);
  const sim = useLounge((s) => s.sim);
  const setSim = useLounge((s) => s.setSim);
  const applyPreset = useLounge((s) => s.applyPreset);
  const resetSim = useLounge((s) => s.resetSim);
  const requestBurst = useLounge((s) => s.requestBurst);
  const openBackstage = useLounge((s) => s.openBackstage);
  const lang = useLounge((s) => s.lang);
  const setLang = useLounge((s) => s.setLang);
  const log = useLounge((s) => s.simLog);
  const users = useLounge((s) => s.users);
  const channelId = useLounge((s) => s.channelByGuild[s.guildId]);
  const c = COPY[lang];
  const parsed = useMemo(() => parsePrompt(sim.prompt), [sim.prompt]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  if (!open) return null;

  const channels = GUILDS.flatMap((g) => g.channels);
  const channelName = channels.find((x) => x.id === channelId)?.name ?? "general";
  const tones = Object.entries(parsed.tone)
    .filter(([, on]) => on)
    .map(([k]) => k);

  return (
    <div className="bs" role="dialog" aria-modal="true" aria-label={c.title}>
      <div className="bs__scroll scroll-thin">
        <div className="bs__col">
          <header className="bs__head">
            <div>
              <h1 className="bs__title">{c.title}</h1>
              <p className="bs__sub">{c.sub}</p>
            </div>
            <button ref={closeRef} className="bs__close" onClick={() => openBackstage(false)} aria-label="Close">
              <CloseIcon size={20} />
            </button>
          </header>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.presets}</h2>
            <div className="bs-presets">
              {PRESETS.map((p) => {
                const active = matchesPreset(sim, p);
                const [name, blurb] = lang === "de" ? PRESET_DE[p.id]! : [p.name, p.blurb];
                return (
                  <button key={p.id} className="bs-preset" data-active={active} aria-pressed={active} onClick={() => applyPreset(p.id)}>
                    <span className="bs-preset__name">{name}</span>
                    <span className="bs-preset__blurb">{blurb}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.world}</h2>
            <Slider
              label={c.activity}
              value={sim.activity}
              display={`${sim.activity.toFixed(2)}×`}
              min={0.25}
              max={3}
              step={0.05}
              left={c.sleepy}
              right={c.chaos}
              onChange={(v) => setSim({ activity: Math.round(v * 100) / 100 })}
            />
            <Slider
              label={c.glaze}
              value={sim.glaze}
              display={`${sim.glaze}%`}
              min={0}
              max={100}
              step={1}
              left={c.hates}
              right={c.worships}
              onChange={(v) => setSim({ glaze: v })}
            />
            <Slider
              label={c.drama}
              value={sim.drama}
              display={`${sim.drama}%`}
              min={0}
              max={100}
              step={1}
              left={c.wholesome}
              right={c.messy}
              onChange={(v) => setSim({ drama: v })}
            />
          </section>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.conversations}</h2>
            <Check label={c.live} desc={c.liveDesc} checked={sim.liveReplies} disabled onChange={(v) => setSim({ liveReplies: v })} />
            <Check label={c.breakChar} desc={c.breakCharDesc} checked={sim.breakCharacter} onChange={(v) => setSim({ breakCharacter: v })} />
            <Check label={c.running} desc={c.runningDesc} checked={!sim.paused} onChange={(v) => setSim({ paused: !v })} />
            <button className="bs-button" onClick={requestBurst} disabled={sim.paused}>
              {c.burst(channelName)}
            </button>
          </section>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.vibe}</h2>
            <label className="bs-field__label" htmlFor="bs-prompt">
              {c.vibeLabel}
            </label>
            <textarea
              id="bs-prompt"
              className="bs-textarea"
              rows={4}
              maxLength={600}
              value={sim.prompt}
              onChange={(e) => setSim({ prompt: e.target.value })}
            />
            <div className="bs-field__meta">
              <span>{sim.prompt.length}/600</span>
              {sim.prompt.trim() !== DEFAULT_SIM.prompt && (
                <button className="bs-link" onClick={() => setSim({ prompt: DEFAULT_SIM.prompt })}>
                  {lang === "de" ? "Standard-Prompt" : "Use default prompt"}
                </button>
              )}
            </div>
            <div className="bs-chips">
              <span className="bs-chips__label">{c.topics}</span>
              {parsed.topics.length ? parsed.topics.map((t) => <span key={t} className="bs-chip">{t}</span>) : <span className="bs-chip bs-chip--empty">{c.none}</span>}
            </div>
            <div className="bs-chips">
              <span className="bs-chips__label">{c.tone}</span>
              {tones.length ? tones.map((t) => <span key={t} className="bs-chip bs-chip--tone">{t}</span>) : <span className="bs-chip bs-chip--empty">{c.none}</span>}
            </div>
            <p className="bs-help">{c.vibeHelp}</p>
          </section>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.language}</h2>
            <div className="bs-seg" role="radiogroup" aria-label={c.language}>
              {LANGS.map((l) => (
                <button key={l.id} role="radio" aria-checked={lang === l.id} data-active={lang === l.id} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <section className="bs-card">
            <h2 className="bs-card__title">{c.feed}</h2>
            {log.length === 0 && <p className="bs-help">{c.feedEmpty}</p>}
            <ul className="bs-feed">
              {log.slice(0, 8).map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <span className="bs-feed__meta">
                    <b>{users[e.authorId]?.displayName}</b> {c.in} #{channels.find((x) => x.id === e.channelId)?.name} ·{" "}
                    <span className="bs-feed__tag">{e.category}</span>
                  </span>
                  <span className="bs-feed__text">{lang === "de" ? e.textDe : e.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <button className="bs-reset" onClick={resetSim}>
            {c.reset}
          </button>
        </div>
      </div>
    </div>
  );
}
