# The Lounge

_private floors. loud rooms._

A dark, Discord-class community app for **GOD // THE LOUNGE** — a Hamburg server
that should feel packed and alive the moment you open it. Original name, logo,
icons and content; no Discord assets, fonts or trademarks.

> **Status: Phases 0–4 done, live at <https://the-lounge-hamburg.vercel.app>** (Vercel,
> Frankfurt, Neon Postgres). UI matched to the reference screenshots, English/Deutsch,
> **Backstage**, persistence + login, the **always-on server floor** (the server plans the
> NPCs — messages, typing, reactions, voice, presence — so the room keeps moving with
> nobody online), and **optional live replies with Claude**: add `ANTHROPIC_API_KEY` and
> redeploy, no code changes. See [`docs/PLAN.md`](docs/PLAN.md).

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
| `pnpm api:check` | API tests: auth, persistence, poll, edits, reactions, history paging, guest limits, owner-only routes, safety filter — plus the live server floor, shared typing, NPC replies, bursts, #ops audit log, catch-up and pause (needs `LOUNGE_ALLOW_TEST_HOOKS=1` for the catch-up test) |
| `pnpm seed` | Validates the 32-NPC cast, channel map and backlog (ages 20–34, no duplicate lines, nothing posted as Elias) and writes `data/seed.json` |
| `pnpm shots` | Renders every screen and the CURRENT vs REFERENCE sheets into `docs/screenshots/` (needs a running server, `BASE_URL` to override) |
| `pnpm smoke` | Browser checks: login form, send → reload → still there, ↑ edit, Esc, reactions, language switch, Backstage, guest read-only, owner floor reaching a guest through the database, mobile navigation |
| `pnpm floor:check` | Server floor planner, in memory with a simulated clock: cold open, 5-minute volume, duplicates, Elias share, replies, every Backstage control, mute, 6-hour catch-up, time of day, replies to humans, bursts |
| `pnpm sim:check` | Simulator acceptance tests with a fake clock (cold open, 5-minute volume, duplicates, Elias share, every Backstage control) |
| `pnpm ai:check` | Live replies end to end against a local mock of the Anthropic API (no key, no cost): request shape, a live reply replacing the built-in line, and refusal / 500 / timeout / unsafe / out-of-character output all falling back to the built-in line on time. Start the app with `ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4599` first |

URLs: `/` (mobile opens on the channel list), `/channels/lounge/<channel>`,
`/channels/lab/roadmap`, `/channels/darkroom/darkroom`.
The test scripts sign in with the owner credentials from `.env.local`.

Debug params: `?local=1` ignores the database (static backlog, nothing saved), `?lang=en|de`, `?backstage=1` opens Backstage, `?sim=off` freezes
the floor (static backlog only), `?debug` exposes `window.__lounge` (store) for tests,
`?frame=ios` simulates the iPhone safe areas (status bar 51pt,
home indicator 34pt) for screenshot comparison; `?fixture=ref` swaps in a channel
list / chat with the same row structure as the reference screenshots.

## Deploy on Vercel

1. **Database (for persistence):** either **Postgres** — Neon / Vercel Postgres from the Vercel
   Marketplace (Storage → Create → Neon; it sets `DATABASE_URL` to the pooled URL) — or a
   free libSQL database on [Turso](https://turso.tech)
   (`turso db create the-lounge`, `turso db show the-lounge --url`, `turso db tokens create the-lounge`).
   The schema and seed data are created automatically on the first request; `postgres://`
   URLs use node-postgres, `libsql://` / `file:` URLs use libSQL.
2. **Environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `LOUNGE_OWNER_EMAIL` | your login email |
   | `LOUNGE_OWNER_PASSWORD` | a strong password (`change-me` is refused in production) |
   | `DATABASE_URL` | Neon pooled `postgres://…` (set by the integration) or `libsql://the-lounge-<org>.turso.io` |
   | `DATABASE_AUTH_TOKEN` | the Turso token (Turso only) |
   | `LOUNGE_SESSION_SECRET` | optional, any long random string |
   | `CRON_SECRET` | optional — lets an external scheduler call `/api/sim/tick` |
   | `NEXT_PUBLIC_APP_URL` | optional, the public URL |
   | `ANTHROPIC_API_KEY` | optional — turns on live replies (see below) |
   | `SIM_MAX_LLM_PER_MIN` | optional, default 12 — global cap on model calls per minute (0 = off) |

3. **Deploy:** import the GitHub repo (framework "Next.js", default commands), or from the
   zip: unzip, `npx vercel`, then `npx vercel --prod`.

**How the floor runs on Vercel:** functions freeze between requests, so the floor advances
whenever someone polls (every 1.5 s per open tab). With nobody online nothing is computed;
the next visitor's first request backfills the gap as believable, thinned-out history
(at most 100 messages, following the time of day) and the Doorman notes it in `#npc-debug`.
If you want messages generated in real time even with nobody watching, point a scheduler
(e.g. cron-job.org, every minute) at `GET /api/sim/tick` with
`Authorization: Bearer $CRON_SECRET`. On a long-running server (`pnpm start`, Docker) a
built-in ticker does this every 4 s (`LOUNGE_FLOOR_TICKER=off` disables it).
Database cost: each tick reads ~600 rows, at most one tick per 4 s — roughly 13M row reads per
day if someone is online around the clock (Turso's free tier allows 500M per month; with the
built-in ticker on a 24/7 server, budget for a paid tier or raise `TICK_EVERY_MS`).

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
- **The floor** runs on the server (Phase 3, below); browsers only read it.
- **Safety filter** (server-side on every human post/edit and every simulator line, and in
  `pnpm seed` for the phrase banks): sexual content involving minors, scams / money requests,
  doxxing (street addresses, phone numbers, IBANs, licence plates) are blocked with a message.
- Rate limits: owner 8 messages / 5 s, guests 3 / 6 s (per server instance).
- **Not yet:** read state is per browser (not stored), no magic-link login, no account
  management beyond the owner + guests.

## The server floor (Phase 3)

- **Planner** (`src/lib/sim/planner.ts`): pure and clock-free — the same brain and phrase
  banks as before, now driven by a time window. It keeps its state (current burst, thread,
  recently used templates) in `sim_state`.
- **Tick** (`src/server/floor.ts`): plans 12 s ahead, at most every 4 s, under a lease so only
  one server instance plans at a time. Future messages are stored with their typing time;
  they become visible when their time comes, and while someone is "typing" the poll reports
  it, so **every visitor sees the same typing indicators**.
- **Replies:** when you post, 1–3 NPCs answer (the first always as a reply to you); when a
  guest posts, someone welcomes them — scheduled on the server, so it works with your tab closed.
- **Catch-up:** after a gap longer than ~4 minutes, the missed time is backfilled as history
  without typing, thinned to at most 100 messages and shaped by the time of day (06:00 is
  ~3× quieter than 22:00); the last 3 minutes are filled at full density.
- **Uniqueness** (spec: "no duplicate strings in the last N messages per channel"): no exact
  repeat within the channel's last 60 messages or the last 100 lines anywhere; a word-overlap
  near-duplicate guard (≥ 75 %) against the channel's last 40 and the last 40 anywhere; and a
  per-mood template window that always leaves the least-recently-used ~20 % of each mood free,
  so a floor running for days never runs out of lines.
- **Pause and mute are instant:** scheduled-but-not-yet-visible lines are dropped, and every
  insert re-checks pause/mute inside the same database transaction.
- **Audit:** Backstage changes are posted to `#ops` by the Doorman ("Backstage: glaze 65% →
  30% · muted Mara"); catch-ups are posted to `#npc-debug`.
- **Local mode** (no database) still runs the floor in the browser, as before.

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
| Live replies | on/off | on (takes effect once `ANTHROPIC_API_KEY` is set; greyed out until then) | NPCs who answer you write their reply with Claude from their persona, the vibe and the recent chat |
| Let people break character | on/off | off | Occasional "wait are we NPCs" jokes |
| Floor is live | on/off | on | Pause / resume the floor — instant, and paused time is not backfilled |
| Start a burst | button | — | 6 quick messages in the channel you're looking at |
| Mute NPCs | chips | nobody | Muted members stop posting and reacting immediately |

Presets: **Default vibe**, **Wholesome Sunday**, **Afterhours chaos**,
**Roast night**; "Reset everything to the default vibe" restores all controls.
Roasts stay playful — the phrase banks contain no slurs, threats, real addresses
or anything involving minors.

The floor's behaviour (both the server floor and local mode): quiet gaps then 3–6 message
bursts, typing indicators, ~45–60 % replies following the relationship graph, max 2 posts in a
row per NPC, NPC reactions, voice join/leave/speaking, presence changes, time-of-day rhythm.

`pnpm floor:check` (server planner, default vibe, 5 simulated minutes, 8 consecutive runs
all green): cold open ≥ 3 messages + a reply chain within 15 s · 67–75 messages · 0
near-duplicate pairs · 0 exact duplicates · ~20 of them mention Elias / The Lounge / his apps
· ~60 % replies · glaze 0 % → 0 % praise, 100 % → 0 % roasts · drama 0 % → 100 % takes
drama/disagree lines from ~5 % to ~23 % · sleepy vs chaos ≈ 9 vs 180 messages in 3 minutes
· 6 hours away → 100 backfilled messages spread over ~90 % of the gap · 22:00 is ~3.5× busier
than 06:00.

## Live replies with Claude (Phase 4)

Off until the server has a key; everything else (the whole floor, typing, reactions, replies)
runs on the built-in stub brain (phrase banks + persona files) and never needs one.

**Turn it on:** Vercel → Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`
(Production) → Deployments → ⋯ → **Redeploy**. Backstage then shows
"Live replies: Claude (…)" and the toggle becomes active (on by default).

What changes with a key: when you (or a guest in #introductions) post, the NPCs who answer
you directly — up to two for the owner, one for a guest — write their line with Claude
(`claude-sonnet-5-5`, low effort, JSON output with an English and a German version). The rest
of the floor stays built-in, which keeps cost tiny. How it works (`src/server/ai.ts`,
`scheduleReplies` in `src/server/floor.ts`):

- The built-in reply is written to the database first, so someone always answers; it is held a
  few seconds longer while the NPC shows as typing, and the model's line replaces it before it
  becomes visible. After the response is sent (`after()`), so posting stays instant.
- Any refusal, error, timeout (6 s), unsafe output (same safety filter as human messages),
  out-of-character output ("as an AI…") or link keeps the built-in line — on its original
  schedule, no extra wait.
- The prompt is the NPC's persona (age 20–34, bio, quirks, topics, language habit), the
  Backstage vibe prompt, glaze and drama, and the last 14 lines of the channel; chat text is
  treated as chat, not as instructions. Adults only, no sexual content involving minors, no
  personal data, no money/crypto pitches. "Let people break character" relaxes only the
  never-admit-you're-simulated rule.
- Server-side refusal fallback is on (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`): a declined request is retried on Anthropic's
  recommended fallback model inside the same call.
- Spend guard: `SIM_MAX_LLM_PER_MIN` (default 12) is enforced across all serverless instances
  through a per-minute counter in the database; an invalid key pauses calls for 10 minutes,
  a 429 for one minute.
- `LOUNGE_AI_MODEL` overrides the model if you ever want a different one.

## Project layout

```
src/app/            routes, layout, globals.css (design tokens + component styles)
src/components/     AppShell, ServerRail, ChannelPanel, Chat, MessageList, MessageRow,
                    MemberList, UserPanel, ProfilePopout, Avatar, Brand, icons (hand-drawn SVG)
src/data/           npcs.ts (cast), guilds.ts (channel map), messages.ts (backlog),
                    seed.ts (assembly + validation), fixture.ts (comparison fixtures)
src/lib/            types, zustand store, markup renderer, time formatting
scripts/            seed.ts, db.ts, compare.mjs (screenshots), smoke.mjs, api-check.mjs, floor-check.ts, sim-check.mjs
src/server/         db (schema, seed, migrations), auth (sessions), repo (queries + permissions),
                    floor (server tick, catch-up, replies, bursts), ticker, http helpers
src/instrumentation.ts  starts the 4 s floor ticker on long-running servers
src/app/api/        auth, bootstrap, poll, messages (+ history, edit, reactions), sim (tick, burst, settings)
src/app/login/      sign-in page
src/lib/sim/        planner (server floor), settings + presets, phrase banks (EN + DE), brain (stub composer), engine (clock)
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
