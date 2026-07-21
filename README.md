# Same Same?

**Same Same?** is a real-time multiplayer word-association party game built for Web and Mobile. Players are shown a category and race to name words that either match everyone else (**Same Same**) or are completely unique (**But Different**).

The game uses **Groq's Llama 3** as a snarky AI Judge that ruthlessly validates players' unique answers!

## Tech Stack
* **Frontend:** React Native Web (Expo), deployed to Vercel. Features a highly styled app-shell architecture with neobrutalist and skeuomorphic "messy desk" aesthetics (ID cards, sticky notes, scattered polaroids).
* **Backend:** Node.js, Express, Socket.io, deployed to Render
* **Database:** Supabase (PostgreSQL, Auth, Storage)
* **AI Provider:** Groq (`llama-3.1-8b-instant`)

---

## How to Play

Same Same? uses a **Gartic.io-style public lobby system** — no long matchmaking queues.

| Path | Description |
|---|---|
| **Quick Play** | Instantly joins the best available open public lobby (or creates one) |
| **Browse Lobbies** | See all open public lobbies live, pick one by mode/config and join directly |
| **Host Private Game** | Create a private room and share a 4-letter code with friends |
| **Join by Code** | Enter a friend's 4-letter code to join their private lobby |

### Default Public Lobbies (always available)
| Code | Name | Timer | Modes |
|---|---|---|---|
| `PLAY` | Classic Mix | 60s | Same Same + But Different + Blitz |
| `FAST` | Speed Round | 30s | Same Same + Blitz |
| `LONG` | Marathon | 90s | Same Same + But Different + Blitz |
| `TEAM` | Team Battle | 60s | Same Same + But Different (teams) |

These lobbies auto-reset after a game ends and are always listed in the browser.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v20+)
- A Supabase Project (with Auth and a `profiles` table)
- A Groq API Key

### 1. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with:
```env
PORT=3000
GROQ_API_KEY=your_groq_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Run the backend:
```bash
npm run start
```
*(The backend will run on `http://localhost:3000` and immediately seed the 4 default public lobbies)*

### 2. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/` with:
```env
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the frontend (Web):
```bash
npm run web
```

---

## 🌐 Deployment Notes

### Supabase OAuth (Google Login)
If you deploy the frontend to Vercel, you must:
1. Add your Vercel URL (e.g. `https://same-same.vercel.app/*`) to your Supabase **Redirect URLs**.
2. Vercel automatically enforces trailing slashes. The Google Auth callback handles this natively using `window.location.href`.

### Render WebSocket Polyfill
The backend uses `@supabase/supabase-js` which requires the native `WebSocket` API. Since Render runs Node environments, we inject the `ws` polyfill in `backend/supabase.js`.

---

## 📜 Full Documentation
For complete architectural details, game mechanics, socket events, and future roadmap, see [PROJECT.md](./PROJECT.md).
