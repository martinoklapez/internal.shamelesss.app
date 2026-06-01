# Shamelesss Pipeline — Chrome extension

Side panel for Creator Pipeline: sign in, **Quick Add** the current Instagram/TikTok profile, and see CRM matches for the active tab.

## Setup

1. Copy `config.example.js` to `config.js` (or edit the included `config.js`).
2. Set values from your `.env.local`:
   - `appUrl` — e.g. `http://localhost:3000` or your deployed internal app URL
   - `supabaseUrl` — `NEXT_PUBLIC_SUPABASE_URL`
   - `supabaseAnonKey` — `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In Chrome: **Extensions → Manage extensions → Developer mode → Load unpacked** and select this `chrome-extension` folder.
4. Click the extension icon to open the **side panel** (right side of the browser).
5. After code changes, go to **chrome://extensions** and click **Reload** on this extension.

You are **not** signed in automatically — the web app cookie does not apply to the extension. Use the **Sign in** form with the same email/password as the internal app. If you were signed in before, the extension restores the session from its own storage after a successful sign-in.

## Auto-accept

Toggle at the top of the signed-in panel (same behavior as Pipeline → Quick Add). When enabled, ready jobs that are FIFO-eligible are confirmed automatically with `allowAuto` (up to 25 per run). Preference is stored in extension storage (`creator-pipeline-quick-add-auto-accept`), separate from the web app’s `localStorage`.

## Auto open / close

On **Instagram or TikTok profile** URLs, the side panel opens automatically when that tab is active. When you leave a profile page (feed, login, other site, or non-profile IG/TikTok path), the panel is disabled for that tab and closes.

You can still open the panel manually via the extension icon on any page.

## Requirements

- Signed-in user must have role **admin**, **dev**, or **developer** (same as Creator CRM in the web app).
- The Next.js app must be running and reachable at `appUrl`.
- Quick Add worker/cron should be configured on the server (see `supabase/CREATOR_PIPELINE.md`).

## Tab context

On an Instagram or TikTok **profile** URL, the panel shows:

- **Creator + profile** when the profile is linked to a creator
- **Profile only** when the profile exists in CRM but has no creator
- **Not in CRM** with a Quick Add button when there is no match

## API

The extension uses Bearer tokens against existing routes:

- `GET /api/creator-pipeline/context?url=...`
- `GET/POST /api/creator-pipeline/quick-add/jobs`
- `POST /api/creator-pipeline/quick-add/jobs/:id/confirm`
- `POST /api/creator-pipeline/quick-add/jobs/:id/retry`

CORS is enabled for `/api/creator-pipeline/*` so the extension origin can call your app.
