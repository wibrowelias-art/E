# The Lounge

_private floors. loud rooms._

A dark, Discord-class community app for **GOD // THE LOUNGE** — a Hamburg server
that should feel packed and alive the moment you open it. Original name, logo,
icons and content; no Discord assets, fonts or trademarks.

> **Status: Phase 0 + Phase 1 done, plus an early slice of Phase 3.** The full UI,
> an English/Deutsch language switch, **Backstage** (activity, glaze ratio, drama,
> vibe prompt, presets) and a built-in-lines NPC simulator that runs in the
> browser. Still to come: persistence + login (Phase 2), the server-side
> always-on tick (Phase 3), live AI providers (Phase 4). See [`docs/PLAN.md`](docs/PLAN.md).

## Run

```bash
pnpm install
cp .env.example .env.local   # optional in Phase 1
pnpm dev                     # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev / production build / serve |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm seed` | Validates the 32-NPC cast, channel map and backlog (ages 20–34, no duplicate lines, nothing posted as Elias) and writes `data/seed.json` |
| `pnpm shots` | Renders every screen and the CURRENT vs REFERENCE sheets into `docs/screenshots/` (needs a running server, `BASE_URL` to override) |
| `pnpm smoke` | Interaction checks: Enter / Shift+Enter, ↑ edit, Esc, reactions, channel switch, language switch, Backstage, mobile navigation |
| `pnpm sim:check` | Simulator acceptance tests with a fake clock (cold open, 5-minute volume, duplicates, Elias share, every Backstage control) |

URLs: `/` (mobile opens on the channel list), `/channels/lounge/<channel>`,
`/channels/lab/roadmap`, `/channels/darkroom/darkroom`.
Debug params: `?lang=en|de`, `?backstage=1` opens Backstage, `?sim=off` freezes
the floor (static backlog only), `?debug` exposes `window.__lounge` (store) for tests,
`?frame=ios` simulates the iPhone safe areas (status bar 51pt,
home indicator 34pt) for screenshot comparison; `?fixture=ref` swaps in a channel
list / chat with the same row structure as the reference screenshots.

## Deploy on Vercel

No environment variables are required for this version (`NEXT_PUBLIC_LOUNGE_ACCENT` is optional).

- **From GitHub (recommended):** vercel.com → Add New → Project → import this repo →
  framework "Next.js" is detected, install/build commands stay default → Deploy.
- **From the zip:** unzip, then in that folder run `npx vercel` (first deploy, creates the
  project) and `npx vercel --prod`. Vercel detects pnpm from `pnpm-lock.yaml`.

Note: the NPC floor runs in each visitor's browser in this version, so it works on
Vercel with no database. Persistence (Phase 2) needs a hosted database on Vercel —
see `.env.example`.

## What works in Phase 1

- Server rail with selection / unread pills and mention badges; three guilds.
- Channel list with `// ` categories, emoji channel names, unread dot + bold,
  mention badge, NEW pill, collapsible categories, staff-only channels (owner).
- Voice channels with connected NPCs, speaking ring + animated waveform, mute/deaf icons.
- Message stream: grouping (same author within 7 min), date dividers + floating
  date pill while scrolling, reply bars with spine, @mentions (highlighted when it's
  you), `#channel` links, markdown bold/italic/code, jumbo emoji, reactions,
  generated photo attachments, hover toolbar (quick react / reply / edit / more).
- Virtualised list (react-virtuoso) that stays pinned to the bottom unless you
  scroll up, with "Jump to present".
- Composer: `Message #general`, Enter sends, Shift+Enter newline, ↑ edits your last
  message, Esc cancels reply / edit / popouts. Sends are local until Phase 2.
- Typing indicator ("Mara and 2 others are typing…"), member list (In voice / Online /
  Offline, status dots, status text, crown, APP tag), profile popouts, skeletons on first paint.
- Responsive: desktop ≥ 1200 (members column), tablet 768–1199 (members drawer),
  mobile < 768 (channel list ↔ chat slide, matched to the reference screenshots).

## Language

English is the default: interface **and** chat. Switch with the ⚙ gear in the
bottom-left panel (desktop), by tapping your status on the mobile user card, or in
Backstage. **Deutsch** turns the interface German and shows the chat as the
original Hamburg German/English mix (each NPC writes German as often as their
persona says). Every backlog line and every simulator line is stored in both
versions, so switching re-renders the whole history instantly. Saved per device.
`pnpm seed` fails if any English line still contains German.

## Backstage

Open it from the sliders icon in the title bar (desktop), the gear / user-card
menu, or `?backstage=1`. Changes apply live and are saved on the device.

| Control | Range | Default vibe | What it does |
| --- | --- | --- | --- |
| World activity | 0.25× sleepy … 3.00× chaos | 1.00× | Posting rate, burst size, typing speed; above 1.6× parallel conversations start |
| Glaze ratio | 0 % everyone hates you … 100 % everyone worships you | 65 % | Mood of Elias-related lines: roast → critical → mild → praise → worship. 0 % and 100 % are absolute |
| Drama level | 0 % wholesome … 100 % messy | 20 % | Share of gossip/beef lines and disagreeing replies vs. wholesome ones |
| Vibe prompt | free text, 600 chars | plans for tonight, film photos, music, food, Elias' drops; friendly, a little teasing | Topics become conversation starters; tone words (hyped / chill / sarcastic / kind) shift style and sliders. Detected topics and tone are shown under the field |
| Live replies | on/off | off (disabled) | Needs an AI provider — arrives in Phase 4 |
| Let people break character | on/off | off | Occasional "wait are we NPCs" jokes |
| Floor is live | on/off | on | Pause / resume the simulation |
| Start a burst | button | — | 6 quick messages in the channel you're looking at |

Presets: **Default vibe**, **Wholesome Sunday**, **Afterhours chaos**,
**Roast night**; "Reset everything to the default vibe" restores all controls.
Roasts stay playful — the phrase banks contain no slurs, threats, real addresses
or anything involving minors.

Simulator (Phase 3 preview, `src/lib/sim/`): quiet gaps then 3–6 message bursts,
typing indicators (sometimes typing then giving up), ~45 % replies following the
relationship graph, max 2 posts in a row per NPC, NPC reactions, voice
join/leave/speaking, presence changes, replies when you post, and backfill when you
return to the tab. Every line is checked against the last 300 messages and the last
110 templates used. **Limits:** it runs in your browser tab, so each visitor sees their
own floor and nothing is saved; the shared server-side tick comes in Phase 3, and there
is no login yet, so anyone who can open the app can open Backstage (owner-only gating
comes with auth in Phase 2).

`pnpm sim:check` (default vibe, 5 simulated minutes): cold open 4 messages + a reply
chain within 15 s · 49–60 messages · 0 near-duplicate pairs · 15–26 mention Elias /
The Lounge / his apps · ~45 % replies · glaze 0 % → 0 % praise, 100 % → 0 % roasts ·
drama 0 % → 100 % raises drama/disagree lines ~5–8× · sleepy vs chaos ≈ 8 vs 140
messages in 3 minutes.

## AI providers (Phase 4 — not wired yet)

The env slots are already in `.env.example`:

```bash
LOUNGE_CHAT_PROVIDER=anthropic   # stub | anthropic | openai | gemini
ANTHROPIC_API_KEY=...            # or OPENAI_API_KEY / GEMINI_API_KEY
SIM_MAX_LLM_PER_MIN=12           # spend guard
```

With no key the sim will use the local stub brain (phrase banks + persona files),
so the server stays alive offline. None of these variables are read in Phase 1.

## Project layout

```
src/app/            routes, layout, globals.css (design tokens + component styles)
src/components/     AppShell, ServerRail, ChannelPanel, Chat, MessageList, MessageRow,
                    MemberList, UserPanel, ProfilePopout, Avatar, Brand, icons (hand-drawn SVG)
src/data/           npcs.ts (cast), guilds.ts (channel map), messages.ts (backlog),
                    seed.ts (assembly + validation), fixture.ts (comparison fixtures)
src/lib/            types, zustand store, markup renderer, time formatting
scripts/            seed.ts, compare.mjs (screenshots), smoke.mjs (interaction checks)
src/lib/sim/        settings + presets, phrase banks (EN + DE), brain (stub composer), engine (clock)
src/lib/i18n.ts     UI strings (English / Deutsch)
docs/               PLAN.md (Phase 0), reference/ (privacy-blurred references), screenshots/
```

## Visual verification (Phase 1)

References: `docs/reference/mobile-channels.jpg`, `docs/reference/mobile-chat.jpg`
(third-party photos and avatars blurred). Each sheet in `docs/screenshots/*.compare.png`
shows REFERENCE | CURRENT | 50 % overlay | difference.

Measured after two correction passes (430 × 932, same pixel probes on both images):

- **Mobile channel list** — header, search, divider and every channel/category row
  within ±0.6pt (except the first `// lobby` label, 1.7pt higher because the slash
  glyphs differ); rail icons, divider, pill within ±0.3pt; user card within ±0.4pt;
  channel text starts at the same x (164.9pt) and "announcements" is 118.5 vs 118.3pt wide.
- **Mobile chat** — avatars and message lines within ±0.6pt, header glyphs within
  ±0.5pt, composer card and all four icons within ±1pt.

Remaining differences (honest list):

- **Font**: Discord's gg sans is proprietary, so Figtree (OFL) is used with sizes
  matched by word width; letterforms and cap height (~5 %) still differ.
- **Emoji**: rendered with the platform emoji font (Noto Color Emoji in the
  screenshots, Apple emoji on iPhone), so glyph shapes differ from the reference.
- **Status bar / home indicator** are drawn by the OS; the browser render only
  reserves their space.
- **Content by design**: Lounge names, generated guild art and initials avatars
  instead of photos, gold owner badge instead of the purple one, no emoji in the
  guild title, Online instead of Invisible, role-coloured names.
- **Gift button → GIF button** in the mobile composer (same slot, same size),
  because Nitro is excluded.
- The mobile back arrow shows a mention badge when other channels have mentions
  (the reference had none).
- **Desktop and tablet have no reference yet.** Only mobile screenshots were
  attached, so desktop layout values (title bar 36, sidebar 240, rows 32,
  composer 44, member list 240) come from Discord's known desktop layout and use
  the sampled colour tokens, but they have not been checked side-by-side.
  Desktop message text uses a derived `#dbdbe0`; the mobile reference's body text
  is `#fcfcfe`.
- **Backstage** (`docs/screenshots/backstage.compare.png`): World and Conversations
  cards within ~2px of the reference. Differences by design: "Live replies" is
  unchecked and disabled until an AI provider exists, "Let people break character"
  is off in the default vibe, and Backstage adds Presets, Vibe prompt, Language,
  Live feed and Reset cards that the reference doesn't show.
