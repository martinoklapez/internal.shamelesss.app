# Creator pipeline schema (`creator_pipeline`)

Creator CRM data lives in the **`creator_pipeline`** Postgres schema (not `public`). There are no views in `public`.

## Exposed schema (required)

For the app API and Supabase client to query these tables, add **`creator_pipeline`** to exposed schemas:

- **Local:** `supabase/config.toml` → `[api] schemas` (already includes `creator_pipeline`)
- **Hosted:** Supabase Dashboard → **Project Settings** → **API** → **Exposed schemas** → add `creator_pipeline`

## Apply migration

```bash
supabase db push
# or run supabase/migrations/20260528120000_create_creator_pipeline_schema.sql in the SQL editor
```

## Profile avatars (storage)

- Bucket: **`creator-pipeline-avatars`** (public read)
- Column: **`creator_pipeline.profiles.avatar_url`**
- On scout (Quick Add / import), the app downloads the platform CDN image server-side and uploads to `{profile_id}/avatar.{ext}`
- Profile import (Instagram/TikTok) scrapes follower count, bio, and public contact emails when available; scouting with a linked creator can auto-add a draft CRM contact (checkbox in scout panel). Stored on `profiles.follower_count`.
- Migration: `20260528180000_creator_pipeline_profile_avatars.sql`
- Requires `SUPABASE_SERVICE_ROLE_KEY` on the Next.js server for uploads

## 3-way associations

| Table | Role |
|-------|------|
| `creators` | Person; optional `avatar_profile_id` picks which linked profile photo to show (NULL = earliest scouted profile) |
| `profiles` | Social account: `handle`, `display_name`, optional `avatar_url` (no `creator_id` column) |
| `contacts` | Rep / direct inbox; `email`, `phone` (E.164) (no `creator_id` column) |
| **`associations`** | Links `creator_id` + optional `profile_id` + optional `contact_id` |

From any entity:

- **Creator** → `associations` where `creator_id = ?` → profile + contact ids
- **Profile** → row where `profile_id = ?` → `creator_id`, then other rows for same creator
- **Contact** → row where `contact_id = ?` → `creator_id`, then other rows for same creator

## Other tables

- `email_templates` — Templates page
- `outreach_rules` — Rules page (`contact_email_ready` → send template or do not send, per `contact_kind`)
- `email_touchpoints`, `outreach_sends`, `activity_events` — Log / outreach
- `outreach_events` — queued by DB trigger when `contacts.email` is set or changed

## Outreach automation (server-side)

1. **Trigger** `contacts_enqueue_email_ready` on `creator_pipeline.contacts` inserts a row into `outreach_events` when a contact gets a usable email (create, add, or change).
2. **Worker** `processPendingOutreachEvents` applies `outreach_rules`, writes `outreach_sends` (`queued`), activity. Contact CRM status stays **`new`** until a send succeeds.
3. **Missive** — `MISSIVE_API_TOKEN` + `MISSIVE_FROM_ADDRESS` → `POST /v1/drafts` with `send: true`; rows move to `sent` and contact/creator status becomes **`contacted`**.

Invoke the worker:

- Automatically after CRM saves (`POST /api/creator-pipeline/mutate` → persist contacts → process events)
- `POST /api/creator-pipeline/process-outreach` (admin session or `Authorization: Bearer $CREATOR_OUTREACH_CRON_SECRET`)
- Supabase Edge Function `process-creator-outreach` (calls the API with cron secret)
- Optional cron: `curl -X POST -H "Authorization: Bearer $SECRET" https://your-app/api/creator-pipeline/process-outreach`

Env:

- `CREATOR_OUTREACH_CRON_SECRET` — cron / edge function auth
- `MISSIVE_API_TOKEN` — Missive API token (Preferences → API)
- `MISSIVE_FROM_ADDRESS` — preferred From alias; must be send-enabled for the API token user (see Missive → Accounts → Aliases → “Allow others to send”)
- `MISSIVE_SEND_FROM_ADDRESS` — optional fallback when the preferred alias only works in the UI composer
- `MISSIVE_FROM_NAME` — optional From display name
- `MISSIVE_TEAM_ID` + `MISSIVE_ORGANIZATION_ID` — route new threads into a shared team inbox (both required when using `team`)
- Edge function: `APP_URL` — base URL of this Next app

## App API

Server routes use **`SUPABASE_SERVICE_ROLE_KEY`** (after admin session check), not the browser session, so parallel loads stay reliable.

- `GET /api/creator-pipeline` — load full store
- `POST /api/creator-pipeline/mutate` — mutations (`replaceStore`, `scoutProfile`, …)
- `POST /api/creator-pipeline/process-outreach` — drain pending outreach events
- `GET /api/creator-pipeline/quick-add/jobs` — active Quick Add queue (team-wide)
- `POST /api/creator-pipeline/quick-add/jobs` — enqueue profile URL(s) for server scrape
- `POST /api/creator-pipeline/quick-add/jobs/:id/confirm` — confirm ready job → CRM persist
- `POST /api/creator-pipeline/process-quick-add` — drain pending scrape jobs (cron / edge function)

## Quick Add queue (server-side)

High-volume profile imports use **`creator_pipeline.quick_add_jobs`** (persistent, team-wide, survives refresh/sessions):

1. **Enqueue** — `POST /api/creator-pipeline/quick-add/jobs` with `{ url }` or `{ urls: [] }`. Dedupes active jobs by normalized platform+handle. UI adds optimistic rows immediately.
2. **Worker** — `processPendingQuickAddJobs` runs Apify scrape, sets `ready` or `failed`, then **re-plans all ready jobs** with queue-aware matching (`lib/creator-outreach/quick-add-integrity.ts`).
3. **Confirm** — `POST .../jobs/:id/confirm` re-plans against CRM + active queue, enforces FIFO unless `force`, runs `quickAddProfile` + persist + outreach.
4. **Realtime** — `quick_add_jobs` is on `supabase_realtime` so all admins see queue updates without relying on poll alone.

### Integrity / review

- **`review_required`** — human must confirm when fuzzy creator match, queue email/creator conflicts, etc.
- **`auto_confirm_eligible`** — only safe paths (existing profile + link creator/contact, no queue warnings).
- **`plan_warnings`** — JSON shown in UI; `severity: block` stops confirm unless override.
- Plans account for **other jobs in the queue** (shadow profiles/creators/contacts) so batch adds do not duplicate creators or steal emails.

### Auto-accept (UI toggle)

When enabled, ready jobs with **no blocking queue conflicts** are confirmed automatically in **FIFO order** (chains up to 25 per run). Includes new profiles/creators/contacts, not only existing links. Amber warnings (fuzzy name match, etc.) still show but do not block auto-accept. **Red/block** conflicts (duplicate email on another queued creator, etc.) still require manual confirm or override.

Invoke the scrape worker:

- After enqueue (fire-and-forget from API)
- `POST /api/creator-pipeline/process-quick-add` (admin session or `Authorization: Bearer $CREATOR_OUTREACH_CRON_SECRET`)
- Supabase Edge Function `process-creator-quick-add`
- **Recommended cron** every 1–2 minutes for backlog (not in repo — configure in Supabase Dashboard)

Env:

- `QUICK_ADD_WORKER_BATCH_SIZE` — max jobs claimed per worker run (1–10, default 3)
- Same `CREATOR_OUTREACH_CRON_SECRET` + `APP_URL` as outreach cron

Migration: `20260531120000_quick_add_integrity_realtime.sql` (columns + realtime publication)

Admin/dev/developer roles only (same as Creator CRM page).

## Chrome extension (`chrome-extension/`)

Side panel for Instagram/TikTok profile tabs: CRM lookup, Quick Add enqueue/confirm, Supabase sign-in.

- Setup: see `chrome-extension/README.md` (copy `config.example.js` → `config.js`, load unpacked in Chrome)
- API: `GET /api/creator-pipeline/context?url=...` (Bearer token from extension session)
- Auth: `requireCreatorCrmApi(request)` accepts `Authorization: Bearer <access_token>` for extension calls; web app still uses cookies

## Missive iframe integration

CRM context sidebar inside Missive for the active email thread.

- **URL (register in Missive → Integrations):** `https://<your-app>/integrations/missive` (HTTPS required; use ngrok/Caddy locally)
- **Page:** `app/integrations/missive/page.tsx` — minimal layout (no admin sidebar), loads `missive.js`
- **API:** `GET /api/creator-pipeline/missive-context?conversationId=...&emails=...` (Bearer token; same auth as extension)
- **Lookup:** `lib/creator-outreach/lookup-missive-context.ts` — match contact by `missive_conversation_ids`, then participant email; resolve creator + linked profiles + outreach dots
- **Auth:** Supabase email/password in the iframe; session stored with `Missive.storeSet` (fallback `sessionStorage` when testing outside Missive)
- **Docs:** [Missive UI/iFrame integrations](https://missiveapp.com/docs/developers/ui-iframe-integrations)
