# The Lounge

_private floors. loud rooms._

A dark, Discord-class community app for **GOD // THE LOUNGE** — a Hamburg server
that should feel packed and alive the moment you open it. Original name, logo,
icons and content; no Discord assets, fonts or trademarks.

> **Status: Phase 0 + Phase 1 (shell UI) done.** The chrome, channel list,
> message stream, members, voice presence, composer and mobile screens run on a
> hand-written static backlog. Persistence, the always-on NPC simulator and live AI
> providers are Phases 2–4 (see [`docs/PLAN.md`](docs/PLAN.md)).

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
| `pnpm smoke` | Interaction checks: Enter / Shift+Enter, ↑ edit, Esc, reactions, channel switch, mobile navigation |

URLs: `/` (mobile opens on the channel list), `/channels/lounge/<channel>`,
`/channels/lab/roadmap`, `/channels/darkroom/darkroom`.
Debug params: `?frame=ios` simulates the iPhone safe areas (status bar 51pt,
home indicator 34pt) for screenshot comparison; `?fixture=ref` swaps in a channel
list / chat with the same row structure as the reference screenshots.

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
