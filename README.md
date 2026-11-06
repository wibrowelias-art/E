# The Lounge

_private floors. loud rooms._

A dark, Discord-class community app for **GOD // THE LOUNGE** — a Hamburg server
that should feel packed and alive the moment you open it. Original name, logo,
icons and content; no Discord assets, fonts or trademarks.

> **Status: Phases 0–2 done, plus an early slice of Phase 3.** UI matched to the
> reference screenshots, English/Deutsch, **Backstage**, a built-in-lines NPC floor,
> and now **persistence + login**: messages, edits and reactions live in a libSQL
> database, history loads from it, everyone sees the same floor through a 1.5 s poll,
> the owner signs in with a password and guests can look around as Tourists.
> Still to come: the server-side always-on tick (Phase 3) and live AI providers (Phase 4).
> See [`docs/PLAN.md`](docs/PLAN.md).

## Run

```bash
pnpm install
cp .env.example .env.local   # then set LOUNGE_OWNER_EMAIL + LOUNGE_OWNER_PASSWORD
pnpm dev                     # http://localhost:3000 → /login
```

Local development creates `./data/lounge.db` (SQLite) on the first request and seeds it
with the guilds, the 32 NPCs and the backlog. `pnpm db:reset` wipes and re-seeds it.

| Script | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev / production build / serve |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm db:reset` / `pnpm db:status` | Wipe + re-seed the database / show row counts (uses `DATABASE_URL` or `./data/lounge.db`) |
| `pnpm api:check` | Phase 2 API tests: auth, persistence, poll, edits, reactions, history paging, guest limits, owner-only routes, safety filter |
| `pnpm seed` | Validates the 32-NPC cast, channel map and backlog (ages 20–34, no duplicate lines, nothing posted as Elias) and writes `data/seed.json` |
| `pnpm shots` | Renders every screen and the CURRENT vs REFERENCE sheets into `docs/screenshots/` (needs a running server, `BASE_URL` to override) |
| `pnpm smoke` | Browser checks: login form, send → reload → still there, ↑ edit, Esc, reactions, language switch, Backstage, guest read-only, owner floor reaching a guest through the database, mobile navigation |
| `pnpm sim:check` | Simulator acceptance tests with a fake clock (cold open, 5-minute volume, duplicates, Elias share, every Backstage control) |

URLs: `/` (mobile opens on the channel list), `/channels/lounge/<channel>`,
`/channels/lab/roadmap`, `/channels/darkroom/darkroom`.
The test scripts sign in with the owner credentials from `.env.local`.

Debug params: `?local=1` ignores the database (static backlog, nothing saved), `?lang=en|de`, `?backstage=1` opens Backstage, `?sim=off` freezes
the floor (static backlog only), `?debug` exposes `window.__lounge` (store) for tests,
`?frame=ios` simulates the iPhone safe areas (status bar 51pt,
home indicator 34pt) for screenshot comparison; `?fixture=ref` swaps in a channel
list / chat with the same row structure as the reference screenshots.

## Deploy on Vercel

1. **Database (for persistence):** create a free libSQL database on [Turso](https://turso.tech)
   (`turso db create the-lounge`, `turso db show the-lounge --url`, `turso db tokens create the-lounge`).
   The schema and seed data are created automatically on the first request.
2. **Environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `LOUNGE_OWNER_EMAIL` | your login email |
   | `LOUNGE_OWNER_PASSWORD` | a strong password (`change-me` is refused in production) |
   | `DATABASE_URL` | `libsql://the-lounge-<org>.turso.io` |
   | `DATABASE_AUTH_TOKEN` | the Turso token |
   | `LOUNGE_SESSION_SECRET` | optional, any long random string |

3. **Deploy:** import the GitHub repo (framework "Next.js", default commands), or from the
   zip: unzip, `npx vercel`, then `npx vercel --prod`.

Without `DATABASE_URL` the deploy still works: it runs in local mode (each visitor's
browser runs its own floor, nothing is saved) and the login page says so. Without an owner
password *and* without a database, the login page offers a demo owner entry; as soon as
either is configured, demo mode switches off.

## Accounts & persistence (Phase 2)

| Who | How | Can |
| --- | --- | --- |
| **Elias (owner)** | `/login` with `LOUNGE_OWNER_EMAIL` / `LOUNGE_OWNER_PASSWORD` | everything: all channels incl. Staff, Backstage, runs the NPC floor |
| **Tourist (guest)** | "Continue as guest" (optional name) | read every non-staff channel, react, post in `#introductions` |

- Sessions are signed httpOnly cookies (HMAC-SHA256, 30 days), so they work with or without
  a database. Wrong passwords are slowed down; checks are constant-time.
- Human messages are stored with `is_human = 1`; the simulator can only write as NPCs — the
  server rejects any simulator line that claims to be Elias, the bot or a guest.
- **Data flow:** `/api/bootstrap` loads users + the last 120 messages per channel; scrolling
  up pages older history from `/api/messages/history`; `/api/poll?since=<rev>` every 1.5 s
  (6 s in a background tab) returns everything changed since a global revision counter —
  new messages, edits, reactions, presence and voice changes.
- **Sending** is optimistic: the message appears instantly, turns solid when the server
  confirms, or shows "Failed to send — Retry / Discard".
- **The floor:** with a database, only the owner's browser runs the simulator (one tab, via
  the Web Locks API) and syncs its output to the server once a second; guests see it through
  the poll. Phase 3 moves this to a server tick so it keeps going with nobody online.
- **Safety filter** (server-side on every human post/edit and every simulator line, and in
  `pnpm seed` for the phrase banks): sexual content involving minors, scams / money requests,
  doxxing (street addresses, phone numbers, IBANs, licence plates) are blocked with a message.
- Rate limits: owner 8 messages / 5 s, guests 3 / 6 s (per server instance).
- **Not yet:** read state is per browser (not stored), typing indicators are only visible in
  the owner's browser, no magic-link login, no account management beyond the owner + guests.

Tables: `users`, `guilds`, `categories`, `channels`, `memberships`, `messages`, `reactions`,
`reaction_users`, `npc_profiles`, `relationships`, `sim_state`, `meta` (revision counter) —
see `src/server/db.ts`.

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
scripts/            seed.ts, db.ts, compare.mjs (screenshots), smoke.mjs, api-check.mjs, sim-check.mjs
src/server/         db (schema, seed), auth (sessions), repo (queries + permissions), http helpers
src/app/api/        auth, bootstrap, poll, messages (+ history, edit, reactions), sim (batch, settings)
src/app/login/      sign-in page
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
