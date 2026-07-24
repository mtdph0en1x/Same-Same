# Same Same? — Project Context

> Read this file at the start of every session to get full project context.

---

## What is this?

**Same Same?** is a real-time multiplayer word-association party game. Each round, players are shown a category and race to name as many matching words as they can within a time limit. Scoring depends on the round type — sometimes you want to think like everyone else, sometimes you want to be the odd one out.

Live URLs:
- **Frontend (Vercel):** deployed from `frontend/`
- **Backend (Render):** deployed from `backend/`, port 3000 locally

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React Native (Expo), targets web + mobile |
| Backend | Node.js + Express + Socket.io |
| Database | Supabase (PostgreSQL, Auth, Storage for avatars) |
| i18n | `react-i18next` for frontend UI translations |
| Fonts | Fredoka (headings) + Nunito (body) via `@expo-google-fonts` |
| Fuzzy match | `natural` npm package (Jaro-Winkler + Porter stemmer) |
| AI Judge | Groq API (`llama-3.1-8b-instant`) |
| Styling | **Neobrutalism & Skeuomorphism** — thick black borders, hard offset shadows, physical ID cards, scattered game mode cards, sticky notes, and a messy desk background with coffee stains. |

---

## Project structure

```
same-same/
├── backend/
│   ├── categories/          # Category packs (JSON files, one per pack)
│   │   ├── classic.json
│   │   ├── food.json
│   │   ├── nature.json
│   │   ├── pop_culture.json
│   │   └── challenge.json
│   ├── gameLogic.js         # Category loading, fuzzy scoring
│   ├── gameSession.js       # Per-game state, round flow, word tracking
│   ├── roomManager.js       # Room lifecycle, language-isolated public lobbies, findOrCreatePublicRoom
│   └── server.js            # Socket.io event wiring
│
└── frontend/
    ├── App.js               # App-shell: persistent chrome (header, news bar,
    │                        #   activity bar, footer) + shared appWindow frame.
    │                        #   All screens render inside the window.
    └── src/
        ├── socket.js        # Socket.io client (reads EXPO_PUBLIC_SERVER_URL)
        ├── styles/theme.js  # Design tokens
        ├── components/      # Shared UI (Button, BackgroundPattern, MessyDeskBackground, Sidebars)
        └── screens/
            ├── LandingScreen.js # 3-column entry page (Visitor Pass, Samesame ID, Transmissions)
            ├── HomeScreen.js    # Dual-panel layout (ID Card Profile vs Play); connects socket on mount
            ├── LobbyScreen.js   # Waiting room, settings panel, countdown
            ├── GameScreen.js    # Multi-word input, chips, progress bar
            ├── ResultsScreen.js # Sequential card reveals, match groups, REJECTED stamp, leaderboard
            └── GameOverScreen.js # Animated podium (1st/2nd/3rd), team winner banner, play-again controls
```

---

## Security & Production Setup

The backend is hardened for production environments (Vercel Frontend + Render Backend).
- **CORS Lockdown:** Socket.io and Express only accept cross-origin requests from explicitly defined `ALLOWED_ORIGINS` (e.g., `https://same-same-one.vercel.app`), preventing iframe hijacking and malicious external clients.
- **WebSocket Rate Limiting:** A global `socket.use` middleware restricts incoming events to 40 events per 5 seconds per socket. Excess events are dropped with an error to protect the Node.js event loop and bandwidth from spam bots.
- **HTTP Rate Limiting:** The `/check-username` API endpoint uses `express-rate-limit` (50 requests per 15 minutes per IP) to block dictionary attacks.
- **Input Truncation (Memory Protection):** Maliciously large strings are immediately truncated upon receipt:
  - `submit_word`: capped at 50 chars.
  - `send_chat`: capped at 250 chars.
  - `send_reaction`: metadata capped at 20/30 chars.
- **Profanity Filtering:** `leo-profanity` checks usernames against English and Russian blocklists.
- **Supabase RLS:** The database `profiles` table and `avatars` storage bucket are secured using Row Level Security to prevent unauthorized access or manipulation of stats.

---

## App-shell architecture

All screens share a **persistent chrome** defined once in `App.js`. No screen renders its own header, footer, or news bar.

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: logo + live player count + version badge      │
│ NewsBar: scrolling announcements strip                    │
├──────────────────────────────────────────────────────────────────┤
│ appWindow (maxWidth 1120, neobrutalist border+shadow)     │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ HomeScreen / LobbyScreen / GameScreen / ResultsScreen / GameOverScreen │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ActivityBar: today’s top 4 players (desktop only)        │
│ PageFooter: links + server status                        │
└──────────────────────────────────────────────────────────────────┘
```

The dark (`rgba(0,0,0,0.4)`) header/footer sit **outside** the white window, creating a "game client" feel similar to Gartic.io and skribbl.io. The `appWindow` frame (border, shadow) is defined once in `App.js`; individual screens simply render their content with `flex: 1` inside.

---

## Game mechanics

### Round flow
1. `round_started` event fires with `{ category, roundType, timeLimit, wordsPerRound, roundNumber, totalRounds }`
2. Each player submits words one at a time via `submit_word` socket event
3. Server emits `word_submitted` per word, `player_finished` when a player hits their limit
4. Round ends when timer expires **or** all players finish early
5. `round_ended` fires with `{ groups, scoreUpdates, newScores, playerNames }`

### Round types (cycle through configured array)
| Name | Solo Rule | Team Rule |
|---|---|---|
| **Same Same** | Words said by 2+ players → each gets `groupSize` pts | Intra-team match (2+ teammates say it) → `groupSize` pts |
| **But Different** | Words said by only 1 player total → +3 pts | Intra-team unique (only 1 teammate says it) → +3 pts |
| **Blitz** | Every submitted word gets a randomly assigned new topic. Scoring follows Same Same rules. | Every submitted word gets a randomly assigned new topic. Scoring follows Team Same Same rules. |

### Game Modifiers
Modifiers are extra rules applied on top of the round type.
- **Rush**: Rewards the fastest player to submit a matching word with +2 speed points. Works with both Same Same and Blitz modes.
- **Traitor** (Planned): One player secretly gets a different category and has to blend in.

### Fuzzy matching & AI Judge
1. **Fuzzy Match:** Words are grouped using **Jaro-Winkler distance > 0.85** OR matching **Porter stems**. This means `tree / trees / tre` all land in the same group. Each player is counted at most once per group (deduplication).
2. **AI Judge (But Different Round):** If a player types a unique word, it is validated by an AI Judge via the Groq API (`llama-3.1-8b-instant`). If the word is complete gibberish or off-topic for the category, the AI rejects it, and the player is penalized (loses points) and shown a hilarious rejection message.

---

## Room config schema

Every couch room stores a `config` object. The host can change it live before starting; guests see it read-only.

```js
{
  roomName:      '',     // optional custom name for public lobbies
  maxRounds:     6,      // options: 3 | 6 | 9
  timeLimit:     60,     // options: 30 | 60 | 90 (seconds)
  wordsPerRound: 5,      // options: 3 | 5 | 7
  roundTypes:    ['Same Same', 'But Different', 'Blitz'],  // any non-empty subset
  categoryPack:  'classic', // 'all' | 'classic' | 'food' | 'nature' | 'pop_culture' | 'challenge'
  teamMode:      false,  // boolean
  modifiers:     []      // array of strings, e.g. ['Rush']
}
```

Config is validated server-side in `roomManager.validateConfig()`. Invalid values fall back to defaults.
For team mode, `roomManager` tracks `teams: { [playerId]: 'A' | 'B' }` and auto-assigns new joiners.

---

## Adding category packs

Drop a new `.json` file in `backend/categories/`. The file must be a JSON array of strings. The filename (without `.json`) becomes the pack ID. Restart the backend — it auto-loads all files in that folder.

```json
["Things in a gym", "Olympic sports", "Things you wear in winter"]
```

---

## Socket events reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `create_room` | `{ name }` | Host creates private couch room |
| `join_room` | `{ roomCode, playerData }` | Guest joins by code |
| `update_config` | `{ roomCode, config }` | Host updates room config |
| `update_teams` | `{ roomCode, teams }` | Host swaps players between teams |
| `kick_player` | `{ roomCode, targetId }` | Host removes a player |
| `leave_room` | `{ roomCode }` | Player leaves lobby |
| `start_game` | `{ roomCode }` | Host triggers countdown |
| `submit_word` | `{ roomId, word }` | Player submits one word during a round |
| `quick_play` | `{ name, avatar, level }` | Find or create a public lobby (Quick Play) |
| `play_again` | `{ roomCode }` | Reset session and return everyone to lobby |
| `get_public_lobbies` | _(none)_ | Request list of open public lobbies |
| `join_matchmaking` | `{ name }` | _(Legacy)_ Player joins online queue |
| `leave_matchmaking` | _(none)_ | _(Legacy)_ Player cancels queue search |
| `accept_match` | `{ matchId }` | _(Legacy)_ Player accepts found match |
| `decline_match` | `{ matchId }` | _(Legacy)_ Player declines found match |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `room_created` | `{ roomCode, players, config }` | Room ready for host |
| `joined_room` | `{ roomCode, players, config, teams }` | Joined successfully |
| `player_joined` | `{ players }` | Player list updated (join/kick/leave) |
| `config_updated` | `{ config }` | Host changed settings |
| `teams_updated` | `{ teams }` | Host swapped teams (`{ [playerId]: 'A'\|'B' }`) |
| `kicked` | `{ message }` | This player was kicked |
| `host_changed` | `{ newHostId, newHostName }` | Host migrated |
| `countdown_started` | `{ count: 3 }` | Countdown begins |
| `countdown_tick` | `{ count }` | Countdown tick (2, 1) |
| `game_started` | `{ players }` | Game begins |
| `round_started` | `{ roundNumber, totalRounds, roundType, category, timeLimit, wordsPerRound }` | New round |
| `word_submitted` | `{ playerId, wordCount }` | A player submitted a word |
| `player_finished` | `{ playerId }` | A player hit their word limit |
| `round_ended` | `{ groups, scoreUpdates, newScores, playerNames, teams, teamScores }` | Round over |
| `reveal_word` | `{ groupIndex, wordIndex, word, playerId }` | Sequential card flip in ResultsScreen |
| `game_over` | `{ scores, playerNames, playerAvatars, teams, teamScores, isPublic, roomCode }` | All rounds complete; triggers GameOverScreen |
| `public_lobbies` | `{ lobbies: [{ code, label, playerCount, maxPlayers, hasCountdown, roundTypes, timeLimit, isPermanent }] }` | Live lobby list (response to `get_public_lobbies`). `label` prioritizes `config.roomName`. |
| `force_lobby` | `{ roomCode, players, host, config, teams, isPublic }` | Pull all clients back to LobbyScreen (after `play_again`) |
| `match_found` | `{ matchId, timeoutMs }` | _(Legacy)_ 4 players found, prompt to accept |
| `match_cancelled` | `{ reason }` | _(Legacy)_ Someone declined, match aborted |

---

## Product roadmap

### Immediate Next Steps (Commercial Readiness)
Before a commercial launch, the following features are prioritized to transition the game from a functioning beta to a polished product:
1. **Topic / Content Engine:** Create a scalable way to serve diverse topics (e.g., via a Supabase `topics` table) to ensure high replayability. This system will also lay the groundwork for multi-language support.
2. **Lightweight Cosmetics (Layer 4):** Since deep progression doesn't fit the party game genre, implement a simple cosmetic system for players to stand out. Specifically, add unlockable/selectable **Profile Picture (PFP) Frames** to reward engagement without feeling like a grind.
3. **"Juice" & Polish (Layer 5):** Enhance the core loop with micro-animations and sound design. Add transitions between screens, countdown audio, and reveal animations to make the game feel premium.
4. **Username Moderation & Safety:** Implement a lightweight profanity filter on the backend for display names and custom room names to protect the public lobby experience.

### Layer 1 ✅ Done
- Configurable couch lobbies (rounds, time, word count, round types, category pack)
- 5 category packs, 125 prompts, file-based (add pack = drop JSON file)
- Multi-word mechanic (submit N words per round, fuzzy match scoring)
- **Team mode** (2v2, 3v3) — Drag-to-swap UI, team score grouping, team-aware scoring

### Layer 2 — Public Lobby System & Language Isolation ✅ Done (replaced matchmaking)
- ~~Matchmaking queue with accept/decline flow~~ → **completely removed** and replaced by Gartic.io-style public lobbies.
- `matchmaker.js` has been permanently deleted; `roomManager.js` now exclusively owns all public and private room logic.
- **Language Segregation**: Every player is assigned a `lang` based on their UI language. Public lobbies and Quick Play matching strictly isolate players by language (`room.config.lang === playerData.lang`).
- **Seeded permanent lobbies**: 4 permanent lobbies created on server startup: `PLAY` (Classic Mix, 60s), `FAST` (Speed Round, 30s), `LONG` (Marathon, 90s), `TEAM` (Team Battle). These are seeded independently for *every* supported language. Permanent lobbies feature an **Overflow Clone** system: when they fill up (8/8) and begin their auto-start countdown, any new players attempting to join are seamlessly diverted into a brand new cloned lobby with the same label, allowing infinite horizontal scaling of permanent lobbies.
- **Quick Play**: `quick_play` socket event → `findOrCreatePublicRoom` scans for any open public lobby matching the player's `lang` and drops the player in; creates a new one if none available.
- **Lobby browser**: HomeScreen Play panel shows live open lobbies for the user's current language (auto-refreshes every 5 s); players can join directly. Custom rooms display their `roomName` if set by the host.
- **Game Over screen**: Animated podium (2nd / 1st / 3rd) with player avatars, team winner banner, rest-of-players list. Context-aware controls: public rooms show "Play Again with Group"; private rooms show host "Play Again" / guest "Waiting for host…"; everyone gets "Quick Play" and "Leave".
- **play_again / force_lobby flow**: 
  - **Private Rooms**: `play_again` → `roomManager.playAgain()` resets `GameSession` and broadcasts `force_lobby` to all players, instantly pulling them back to LobbyScreen.
  - **Public Rooms (Party Up System)**: `rematch_vote` → Starts a 15-second "Party Up" countdown directly on the Game Over screen. When the timer ends, the server purges any AFK players and transitions only the voters to the lobby together. If they were in a Hostless lobby, the server creates a brand new Custom Public Lobby for them, promoting the first voter to Host.

### Layer 3 — Database & Auth ✅ Done
- **Supabase** — auth + persistent DB profiles
- Mobile & Web: Dedicated 3-column Landing Screen handling Email/Password, Google OAuth, and Guest sessions.
- Stats: games played, win rate, victories tracked and auto-updated by the backend Service Role.

### Layer 4 — Lightweight Cosmetics (The Economy) 🚧 In Progress
- **Cosmetics:** ✅ Custom user-uploaded avatars via Supabase Storage. Added concept for unlockable **Profile Picture (PFP) Frames**.
- **Leaderboards:** Global and weekly leaderboards pulled directly from Supabase. (Pending)
- **Monetization (Freemium Model):** Guest/Free players get the "Classic" pack. VIP/Premium Hosts can buy "Expansion Passes" or individual packs. If the Host owns the pack, everyone in the lobby gets to play it. (Pending)

### Layer 5 — “Juice” & Polish (The Player Experience) 🚧 In Progress
- **Micro-animations:** ✅ Native modal bottom-sheets, bouncy animated `PlayerCard`s, squishy tactile buttons.
- **Sound Design & Haptics:** ✅ Phone vibrations (haptics) on button press and success actions. (Music/SFX pending).
- **Frictionless Onboarding:** ✅ Dedicated Landing Page with Google OAuth for seamless web/mobile login.
- **Physical ID Aesthetic:** ✅ Embedded login forms directly into scalable ID card graphics for an immersive "Visitor Pass" and "Same Same ID" feel.
- **Skeuomorphic Elements:** ✅ "Messy Desk" background with coffee stains, polaroids, tape, sticky notes, and scattered, randomly-rotated mode cards.
- **App-shell layout:** ✅ Persistent branded chrome (header, news, leaderboard bar, footer) wraps all screens in a shared window, consistent across every game screen.
- **REJECTED stamp:** ✅ In *But Different* mode, AI-rejected words display a dramatic animated rubber-stamp overlay in `ResultsScreen` — slams in with a spring animation, rotated −25°, red border + text.
- **Night Mode:** ✅ A simple dark overlay toggle in the header to dim the bright aesthetic for late-night play without breaking styles.
- **ResultsScreen Mobile UX:** ✅ Hid `LeaderboardSidebar` during active gameplay on mobile to save space, and reduced `BoardCard` sizes/tweaked flex layouts to prevent wrapping and overlapping.
- **Cinematic Reveal Camera:** ✅ Implemented an auto-scrolling camera that focuses on each player during their card reveal, locking manual scroll until the reveal finishes.
- **Unified Lobbies:** ✅ Merged 'Public' and 'Private' lobby creation into a single flow with a dynamic 'Room Privacy' toggle in the host's settings panel. Lobbies can be switched between private and public on the fly.
- **HomeScreen Refactor:** ✅ Consolidated all play options into a single, clean 'Play' panel, removing arbitrary Public/Private tabs. Standardized all action buttons with native subtext support.

### Layer 6 — Infrastructure & Launch ✅ Done
- **Backend Scaling:** Deployed Node.js/Socket.io backend to Render.
- **Frontend Hosting:** Deployed React Native Web frontend to Vercel.

---

## Platform split
| Platform | Auth | Matchmaking | Notes |
|---|---|---|---|
| Web | ✅ Optional/Required for MM | ✅ | Fully playable on Vercel, supports Google OAuth & Matchmaking |
| Mobile | ✅ Optional/Required for MM | ✅ | Full feature set, profiles, ranked play |

---

## Key decisions & rationale

- **Fuzzy matching threshold 0.85** — catches typos and plurals, strict enough to avoid false positives
- **JSON category files** — zero dependencies, version-controlled, trivial to add packs. Will migrate to Supabase table in Layer 3.
- **Server-side countdown** — prevents race conditions if a client is slow to load
- **Config validated server-side** — clients can't send invalid values
- **Host migration** — always to the next player in the list; new host gets a banner notification
- **Round type cycling** — repeats the array if only one type is selected (no minimum enforced)
- **Port 3000 locally** — both backend and frontend `.env` point here; Render injects its own `PORT` in production
- **Gartic-style public lobbies over matchmaking queues** — queues with accept/decline flows create friction and abandoned matches. Persistent seeded lobbies let players drop in instantly (like Gartic.io / skribbl.io), require no 4-player minimum, and self-reset when empty. The socket stays alive across HomeScreen → LobbyScreen transitions to support the lobby browser refresh cycle without reconnect overhead.
- **Sequential `reveal_word` events** — cards flip one by one rather than all at once, creating suspense. Cards show neutral gray on flip and only resolve (scale pop + colour) once all cards in a group are revealed. Rejected cards display their mode-appropriate colour (red in But Different, green in Same Same) with a "REJECTED" stamp.

---

## Testing & CI

- **Backend Tests:** Run `npm test` in the `backend/` directory.
  - **Unit Tests:** `gameLogic.test.js` covers scoring mechanics (solo/team variants, deduplication, fuzzy matches).
  - **Integration Tests:** `integration.test.js` covers socket room lifecycle, configuration, player kicking, and full game round flows.
  - *Note:* The tests use lightweight CJS mocks for the `natural` library's ESM-only dependencies to avoid Babel compilation overhead, while retaining standard Jaro-Winkler logic.
- **CI/CD:** GitHub Actions (`backend-tests.yml`) runs tests on every push. `mobile-build.yml` runs EAS builds for the app on tags.

---

## Moderation backlog

### Usernames — uniqueness

Right now `handleSaveName` in `HomeScreen.js` does a raw `.update()` with no uniqueness check. Two users can have the same username.

**Steps to fix:**

1. **Add a unique constraint in Supabase SQL editor** (one-time):
   ```sql
   -- Case-insensitive unique index (so "Rus3kk" and "rus3kk" are the same)
   CREATE UNIQUE INDEX profiles_username_lower_key ON profiles (LOWER(username));
   ```
   Once this is in place, Supabase returns a `23505` error on duplicate `.update()` calls automatically — the existing `catch (err)` block in `handleSaveName` will surface it.

2. **Add client-side format validation** in `handleSaveName` before calling Supabase:
   - Min 3 / max 20 chars
   - Alphanumeric + underscores only (regex: `/^[a-zA-Z0-9_]{3,20}$/`)
   - Can't be all digits

3. **Block reserved names** (static list checked client-side):
   - `Admin`, `Moderator`, `SameSame`, `System`, `Host`, `Bot`, etc.

### Usernames — content moderation

4. **Install `bad-words` npm package** in `backend/`:
   ```bash
   npm install bad-words
   ```
   Add a `/check-username` REST endpoint in `server.js` that the client calls before saving. If the name fails, return a 400 with a user-facing message.

### Avatars — content moderation

Options in rough order of effort:

| Option | How | Cost |
|---|---|---|
| **Reactive / manual** | Add a "report" button → writes to a `reports` table → review via Supabase dashboard | Zero |
| **`moderation_status` column** | Add `pending\|approved\|rejected` to `profiles`. Flagged avatars serve a placeholder until approved. | Low |
| **AI scan on upload** | Client POSTs image to backend → backend calls Sightengine (100 free/day) or Google Vision SafeSearch → backend writes URL to Supabase if clean | Medium |
| **Preset avatars only** | Replace free upload with ~20 curated illustrated avatars baked into assets. Zero moderation needed. Fits the neobrutalist aesthetic well. | Medium (design) |

Backend already has the Supabase service role key (`backend/supabase.js`), so an upload-proxy endpoint is the natural fit if going the AI route.

---

## Multi-language support

### Design principle

Language is a **player-level property**, not a room-level one — because the public lobby system has no pre-game host step where a language could be chosen. A player sets their language once (on HomeScreen, before joining), and it travels through the entire pipeline from there.

Couch lobbies work differently: the host sets language as a room config option (same as rounds/time), and everyone who joins plays in that language. Both modes are consistent — language is just set at different moments.

### Lobby architecture

Public lobbies are currently keyed by a short room code. For multi-language support they would need a **language** property in room config so `findOrCreatePublicRoom` can filter by language:

```js
// Extended findOrCreatePublicRoom logic
const room = openRooms.find(r => r.isPublic && r.config.lang === lang && r.playerCount < r.config.maxPlayers);
```

The seeded permanent lobbies would need language variants (e.g. `PLAY_FR`, `PLAY_DE`) or a single language-neutral lobby with per-round language selection.

### Data flow

```
Player selects language on HomeScreen
  → sent in quick_play payload         { name, avatar, level, lang }
  → stored on queue / lobby entry      { ..., lang }
  → findOrCreatePublicRoom filters by  lang
  → stored in room config              { lang: 'fr', ... }
  → getRandomCategory filters by       lang (pack naming: classic_fr.json)
  → stemmer selected by                lang (natural has stemmers per language)
  → AI judge prompt includes           target language context
```

### Affected files

| File | Change |
|---|---|
| `matchmaker.js` | _(Legacy)_ Dynamic queue keys `${mode}:${lang}` |
| `roomManager.js` | Accept `lang` in room config; filter in `findOrCreatePublicRoom`; pass to `getRandomCategory` and `validateWords` |
| `gameLogic.js` | Stemmer map keyed by lang (`natural.PorterStemmerFr`, etc.); pack files filtered by lang |
| `aiValidator.js` | Accept `lang` param; include target language in judge prompt |
| `HomeScreen.js` | Language selector UI (flag row) before Quick Play; send `lang` in `quick_play` |
| `LobbyScreen.js` | Language option in couch room config panel (host-only, like other settings) |
| `backend/categories/` | Translated pack files: `classic_fr.json`, `classic_de.json`, etc. |

### Long wait times

**Do not offer to switch the player to another language.** Not everyone speaks English at a level where they could play a word game in it — forcing a language switch is exclusionary, not helpful.

Better fallbacks for thin language queues (e.g. after 90s with no match):

1. **Fill with bots** — the game already has a bot spawner (`backend/scripts/spawn_bots.js`). Auto-fill remaining slots with bots in the player's language.
2. **Private lobby invite** — show a shareable room code/link the player can send to friends directly, bypassing matchmaking.
3. **Honest wait estimate** — show approximate queue depth for their language so they can make an informed choice themselves.

### Content work (the real effort)

The code changes for the backend are a day of work. The category pack translations are the actual bottleneck:
- Each new language needs all active packs translated
- Machine translation is fine for a first pass but needs native review — word association games are very sensitive to unnatural phrasing
- Start with one language end-to-end (e.g. French or Spanish) before building the full system

### Frontend UI Translation (In Progress 🚧)
We are actively migrating the frontend UI to use `react-i18next`.
- **Supported Languages (WIP):** English (`en`), Spanish (`es`).
- **Detection:** The web client automatically reads `window.navigator.language` to set the default locale.
- **Selector:** A scalable `LanguageModal` is accessible from the Mobile Tab Bar and Desktop Play Panel in `HomeScreen.js`, allowing users to hot-swap languages instantly.


