# The Lounge — Phase 0 plan

_private floors. loud rooms._

## Stack (confirmed, defaults kept)

| Layer | Choice | Status |
| --- | --- | --- |
| Framework | Next.js 15 App Router, TypeScript strict (`noUncheckedIndexedAccess`) | Phase 1 ✓ |
| Styling | Tailwind v4 + token-driven component CSS (`src/app/globals.css`) | Phase 1 ✓ |
| Client state | Zustand (`src/lib/store.ts`) | Phase 1 ✓ |
| Message list | react-virtuoso (virtualised, stick-to-bottom) | Phase 1 ✓ |
| Font | Figtree (OFL) via `@fontsource-variable/figtree` | Phase 1 ✓ |
| Persistence | libsql / SQLite (`DATABASE_URL=file:./data/lounge.db`, Turso-ready) | Phase 2 |
| Realtime | server tick + SSE, client simulation fallback | Phase 3 |
| AI | `ChatProvider` = `stub` \| `anthropic` \| `openai` \| `gemini`, `SIM_MAX_LLM_PER_MIN` guard | Phase 4 |

## Accent

`#7d8ee8` — sampled from the reference ("NEW" pill text). Override with
`NEXT_PUBLIC_LOUNGE_ACCENT`. Button fills use a darker mix of it
(`--accent-solid`) so white text stays readable.

## Channel map (GOD // THE LOUNGE)

```
// lobby      # 🚪 welcome (slowmode, Doorman bot posts rules) · # 👋 introductions
// floors     # 🍸 general · # ✨ glaze · # 🌃 hamburg-night · # 📷 photo-dump (NEW)
              # 🛠️ build-in-public · # 🎲 random · # 🐸 memes
Voice         🔊 Lounge Main · 🔊 Afterhours · 🔊 AFK
Staff 🔒      # 🛡️ ops · # 🧪 npc-debug        (owner role only)
```

Also: **Elias Lab** (`#roadmap`, `#feedback`) and **Darkroom Club** (`#darkroom`)
so the server rail has the same number of guild icons as the reference.

Roles: Owner (gold, crown) · Inner Circle (rose) · Regular (blue) · Tourist
(default) · Bot (accent, `APP` tag) · NPC (hidden flag `isNpc`, never shown).

## Cast — 32 NPCs (all 21–34), 12 sample bios

Full roster with traits, quirks, topics, activity curve, German/English ratio
and reply graph: `src/data/npcs.ts`. Validated by `pnpm seed`.

| NPC | Age · place | Opinion of Elias | Bio |
| --- | --- | --- | --- |
| **Mara** `mara.nachts` | 26 · St. Pauli | fan | Barista by day, plus-one professional by night. Organises half the outings, forgets her own jacket at all of them. lowercase, double emoji. |
| **Jonas** `jnsbrt` | 29 · Barmbek | rival-friend | Frontend dev, coffee snob, Elias' most loyal critic. Will praise a launch and file three bug reports in the same breath. |
| **Ida** `ida.analog` | 30 · Ottensen | skeptic-warm | Film photographer. Loves his night work and will still tell you the highlights are clipped. Talks in exposure stops. |
| **Tarek** `tarek.wav` | 31 · Altona | chill | DJ/producer. Plays basements, not festivals, on purpose. Short messages, never capitals. |
| **Niko** `nikopolis` | 32 · St. Georg | chill | Bartender, knows every late späti and every bouncer's birthday. The server's night oracle. |
| **Clara** `clrx` | 29 · Winterhude | skeptic-warm | PM who plans every photo walk like a launch. Numbered lists, "reminder:" openers. |
| **Noor** `noor.exe` | 28 · Berlin | skeptic-warm | Backend engineer. One-line answers, no emoji, always right about databases. |
| **Leni** `lenivibes` | 23 · Neukölln | fan | Fashion student, treats invite cards like museum pieces, knows the gossip first. |
| **Kemal** `kemo` | 25 · Wilhelmsburg | chill | Gamer and meme archivist. 💀 as punctuation. Stays home, knows everything. |
| **Hanna** `hanna.grain` | 25 · Bremen (online) | fan | Photo editor determined to reverse-engineer Elias' film recipe. |
| **Daniel** `dnl` | 31 · Friedrichshain | rival-friend | Ex-crypto bro, now ironic crypto bro. Solana jokes. "war ein witz. halb." |
| **Amira** `amira.k` | 27 · Eppendorf | chill | Night-shift nurse, reads chat at 4am and batch-replies to everything. |

Mix: 10 fans · 4 rival-friends · 11 chill · 7 skeptic-warm; 6 night owls,
8 always-on, 14 evening, 4 morning lurkers. 21 of 32 live in Hamburg,
23 write mostly German, 5 are English-only (online / abroad).

## Backstage = the spec's `/ops` god mode

| Spec item | Where |
| --- | --- |
| Pause / resume | Backstage › Conversations › "Floor is live" |
| Density slider (chill → packed club) | Backstage › World activity (0.25× – 3×) |
| Force topic | Backstage › Vibe prompt (topics + tone) |
| Spawn burst in a channel | Backstage › "Start a burst in #channel" |
| Glaze / drama dials (owner request) | Backstage › Glaze ratio, Drama level |
| View last AI prompt/response | Backstage › Live feed shows the last lines + category (stub); prompts appear here once Phase 4 lands |
| Mute one NPC | not yet (Phase 3, server tick) |

Defaults ("Default vibe"): activity 1.0×, glaze 65 %, drama 20 %, prompt about
tonight's plans, film photos, music, food and Elias' drops; friendly, a little teasing.

## Language

English default (UI + chat). Deutsch = German UI + the original Hamburg mix,
per-NPC `germanRatio`. Every seeded and generated line is stored as `{ en, de }`.

## Simulation design (Phase 3/4, informs the data model now)

- **Tick** picks a channel by weight × recent activity × time-of-day curve,
  then an act: new topic · reply (≥ 40 %) · react · typing-then-abort ·
  voice join/leave · status change. Burstiness: 20–90 s quiet, 3–6 message flurry.
- **Uniqueness**: normalised fingerprint (`fingerprint()` in `src/data/seed.ts`,
  already used to validate the backlog) against the last 200 messages per channel,
  plus a near-duplicate trigram check.
- **Topic mix**: ~35 % Elias / The Lounge / IMAGEFORGE / SPOTLY / his night,
  ~65 % everything else. Glaze must name something specific.
- **Safety**: hard filter before posting (minors / sexual content involving
  minors, scams, doxxing, real addresses). All personas 18+.
- **Never** posts as the owner account. Human messages carry `isHuman=true`.

## Data model (Phase 2)

`users`, `guilds`, `channels`, `categories`, `memberships(role)`,
`messages(isHuman, replyToId, editedAt)`, `reactions(messageId, emoji, userId)`,
`npc_profiles`, `relationships(from, to, weight)`, `sim_state(paused, density, forcedTopic)`,
`read_state(userId, channelId, lastReadId, mentions)`. TypeScript shapes already live
in `src/lib/types.ts`; `pnpm seed` writes `data/seed.json` for the DB seeder.

## Measurements (reference screenshots)

Both references are 1280×2772 JPEGs. The iOS status-bar glyphs ("16:00" is
36.5pt wide, digits 11pt tall at 390pt scale — SF Pro 17pt is ~40pt/12pt) show
they were taken on a **430pt-wide iPhone** (Plus / Pro Max), so the comparison
viewport is **430×932 @ 2.977×**, not 390×844. At that scale every metric lands
on clean values (rows 40, channel font 16, title 20), which confirms it.
The layout is fluid and also checked at 390×844.

Mobile channel screen (pt):

| Element | Value |
| --- | --- |
| Rail width / icon / radius / gap | 79 (+1 border) / 52 / 13 / 13 |
| Selected pill | 4 × 43, unread 4 × 8 |
| Channel panel radius / border | 24 / 1px `#222224` |
| Title / meta | 20 bold `#fbfbfb` / 14 medium `#acacb4` |
| Search + invite | 34.5 tall, radius 8.5, `#29282d`, gap 14 |
| Divider | 1px `#29282d`, 17.5 below search |
| Channel row | 40 tall, 8 inset, radius 8.5, text 16.5 (Figtree, width-matched to gg sans 16) |
| Category block | 47 tall, 14 semibold `#acacb4` |
| Selected row | `#343338` · NEW pill 20 tall `#2c2d32` text `#7d8ee8` |
| Hash / speaker / lock glyph | 16.4 / 18 / 15 × 18.5, `#84838b` |
| User card | 61 tall, radius 22, `#252429`, avatar 66 + 2 ring, bell 57.5 × 34.5 `#333237`, badge 19.5 `#d02e3b` |

Mobile chat screen (pt):

| Element | Value |
| --- | --- |
| Header | 61 incl. 1px `#29282d` divider; back 19pt glyph, `#` + name 18.2 bold, search 17pt glyph |
| Channel start | circle 70 `#242328`, title 24.3 bold, sub 16.5 / 21.5 |
| Message | avatar 44 at x 13, text x 70, body 16.5 / 22.7 `#fcfcfe`, name 16 semibold, time 12.2 `#97979f` |
| Spacing | group margin 17.2, row padding 2.45 (one-line group pitch 68.5) |
| Composer | 63 tall card, radius 17.5, `#252429` + 1px `#29282d`, 17.5 side inset, icons 18–20pt |
