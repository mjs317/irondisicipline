# Iron Discipline

Personal workout tracker (React + Vite + Supabase + Vercel) with optional AI coaching.

## Environment variables

### Frontend (Vite)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_USER_ID` | Single stable string for row scoping (default `michael` in code) |

### Vercel serverless (`api/coach.js`, `api/plan-week.js`)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for **INSIGHT** tab, **follow-up**, and **Generate week weights** |

Set these in Vercel **Project → Settings → Environment Variables** and redeploy.

**Endpoints:** `/api/coach` (session + structured JSON + follow-up messages), `/api/plan-week` (JSON weight suggestions). The Vite dev proxy sends all `/api/*` routes to `vercel dev` on port 3000.

## Supabase schema & RLS

The app expects tables including `personal_records`, `workout_sessions`, and `today_log` with JSON columns for `sets_data` / `metcon_sel`.

**Row-level security:** The anon key is bundled in the client. You must configure RLS so:

- Only rows matching your `VITE_USER_ID` (or your auth user id) are readable/writable, or
- You restrict the anon key to a trusted deployment only.

Without strict RLS, anyone with the URL and anon key could read or tamper with data.

### `workout_sessions` unique constraint (phase)

Hypertrophy and strength sessions on the same calendar day must not overwrite each other. Apply:

`supabase/migrations/001_workout_sessions_phase.sql`

If your constraint name differs, adjust the `DROP CONSTRAINT` line using the name shown in Supabase **Table Editor → workout_sessions → Constraints**.

### `coach_context` on `today_log` and `workout_sessions`

Session form fields (run miles + run type, sleep hours, perceived sleep, deload/race flags) are saved as JSON for AI. Apply:

`supabase/migrations/002_coach_context.sql`

### `today_log` unique (one row per user per day)

Upserts use `ON CONFLICT (user_id, log_date)`. If save fails with *“no unique or exclusion constraint matching the ON CONFLICT specification”*, apply:

`supabase/migrations/003_today_log_unique.sql`

The same error on **`workout_sessions`** means **`001_workout_sessions_phase.sql`** has not been applied yet.

## Local development

```bash
npm install
npm run dev
```

Vite runs on **http://localhost:5173** (see `vite.config.js`).

**Coaching API:** `/api/coach` is proxied to **http://127.0.0.1:3000**. Run Vercel’s dev server in another terminal:

```bash
npx vercel dev --listen 3000
```

Then **Get coaching** and **plan week** work from the Vite app. Without `vercel dev`, the proxy will fail.

## Features (in-app)

- **PRs** are recomputed from all saved `workout_sessions` (up to 500 rows) so correcting a bad entry updates all-time bests.
- **Export / import JSON** backup (PRs tab and Stats tab).
- **STATS** tab: estimated tonnage, session streak, sessions per ISO week, recent best weights per lift.
- **AI week plan:** suggests working weights from history + PRs; **Apply this day** / **Apply all days** fills weight fields for the current phase.
- **Session context** on Workout (run miles + type, sleep hours + perceived quality, deload/race); saved as **`coach_context`**. **INSIGHT** tab: analyze this session or last 7 days (JSON + follow-up).

## Build

```bash
npm run build
```

Output: `dist/`.

## PWA

Icons live in `public/icon-192.png` and `public/icon-512.png` (square). After changing icons, **remove the site from the home screen and re-add** (or clear site data) so the OS picks up the new icon.

The service worker caches name is bumped in `public/sw.js` when deploy freshness needs a hard reset.
