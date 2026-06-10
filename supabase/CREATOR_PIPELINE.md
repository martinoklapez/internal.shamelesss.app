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
- `send_from_addresses` — Senders page (Gmail/Missive From aliases for outreach)
- `outreach_rules` — Rules page (`contact_email_ready` → template + sender or do not send, per `contact_kind`)
- `email_touchpoints`, `outreach_sends`, `activity_events` — Log / outreach
- `outreach_events` — queued by DB trigger when `contacts.email` is set or changed

## Outreach automation (server-side)

1. **Trigger** `contacts_enqueue_email_ready` on `creator_pipeline.contacts` inserts a row into `outreach_events` when a contact gets a usable email (create, add, or change).
2. **Queue worker (Vercel)** — `processPendingOutreachEvents` applies `outreach_rules`, writes `outreach_sends` (`queued`), activity. Contact CRM status stays **`new`** until a send succeeds.
3. **Send worker (Supabase Edge)** — `process-creator-outreach-sends` drains `queued` rows via Missive (`POST /v1/drafts`, `send: true`); rows move to `sent` and contact/creator status becomes **`contacted`**.

Invoke queue + send:

- After CRM saves (`mutate` / Quick Add confirm) — queue on Vercel, then `functions.invoke('process-creator-outreach-sends')`
- **Cron** — `pg_cron` every 2 minutes via migration `20260605120000_creator_pipeline_edge_cron.sql` (see Vault setup below)
- `POST /api/creator-pipeline/process-outreach` — queue pending events + invoke send worker
- `POST /api/creator-pipeline/process-outreach-sends` — send queued emails only
- Edge `process-creator-outreach` — cron proxy to Vercel queue worker (`APP_URL` required)

Deploy send worker:

```bash
npm run deploy:outreach-sends-edge
supabase secrets set MISSIVE_API_TOKEN=... MISSIVE_TEAM_ID=... MISSIVE_ORGANIZATION_ID=...
```

Env (Vercel): `CREATOR_OUTREACH_CRON_SECRET`, `APP_URL` (for `process-creator-outreach` proxy only).

Env (Edge secrets for sends): `MISSIVE_API_TOKEN`, `MISSIVE_TEAM_ID`, `MISSIVE_ORGANIZATION_ID`, optional `MISSIVE_FROM_NAME`, `OUTREACH_SEND_EDGE_BATCH_SIZE` (default 5, max 20).

Missive sends run **only on Edge** — do not set `MISSIVE_*` on Vercel. Local dev queues on save; Edge invoke or pg_cron sends.

**Senders** (UI `/pipeline/senders`) — allowed From addresses; each must be a Gmail “Send mail as” + Missive alias with API send enabled.

## App API

Server routes use **`SUPABASE_SERVICE_ROLE_KEY`** (after admin session check), not the browser session, so parallel loads stay reliable.

- `GET /api/creator-pipeline` — load full store
- `POST /api/creator-pipeline/mutate` — mutations (`replaceStore`, `scoutProfile`, …)
- `POST /api/creator-pipeline/process-outreach` — queue outreach from pending events + invoke send worker
- `POST /api/creator-pipeline/process-outreach-sends` — send queued outreach via Edge
- `GET /api/creator-pipeline/quick-add/jobs` — active Quick Add queue (team-wide)
- `POST /api/creator-pipeline/quick-add/jobs` — enqueue profile URL(s) for server scrape
- `POST /api/creator-pipeline/quick-add/jobs/:id/confirm` — confirm ready job → CRM persist
- `POST /api/creator-pipeline/process-quick-add` — drain pending scrape jobs (cron / edge function)

## Quick Add queue (server-side)

High-volume profile imports use **`creator_pipeline.quick_add_jobs`** (persistent, team-wide, survives refresh/sessions):

1. **Enqueue** — `POST /api/creator-pipeline/quick-add/jobs` with `{ url }` or `{ urls: [] }`. Dedupes active jobs by normalized platform+handle. UI adds optimistic rows immediately.
2. **Worker (Supabase Edge)** — Edge Function `process-creator-quick-add` runs `processPendingQuickAddJobs` (Apify scrape, `ready` / `failed`, queue-aware re-plan). Confirm and CRM persist stay on Vercel.
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

- After enqueue / retry — Vercel API calls `supabase.functions.invoke('process-creator-quick-add')` (fire-and-forget)
- **Cron** — same `pg_cron` migration as outreach sends (every 2 minutes)
- `POST /api/creator-pipeline/process-quick-add` — proxies to Edge; local dev fallback when `NODE_ENV=development` or `QUICK_ADD_VERCEL_WORKER_FALLBACK=true`

Deploy Edge worker (bundles `lib/` into `supabase/functions/_shared/` first):

```bash
npm run deploy:quick-add-edge
# or: npm run bundle:quick-add-edge && supabase functions deploy process-creator-quick-add
supabase secrets set APIFY_API_TOKEN=... CREATOR_OUTREACH_CRON_SECRET=...
```

Edge secrets: `APIFY_API_TOKEN`, optional `CREATOR_OUTREACH_CRON_SECRET`, optional actor overrides. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Env (Vercel / local Next.js):

- `QUICK_ADD_EDGE_BATCH_SIZE` — jobs per Edge run (1–3, default 1; sequential Apify)
- `QUICK_ADD_WORKER_BATCH_SIZE` — Vercel fallback batch (1–10, default 3)
- `QUICK_ADD_VERCEL_WORKER_FALLBACK=true` — run scrape on Vercel when Edge invoke fails (local dev default via `NODE_ENV=development`)

Migration: `20260531120000_quick_add_integrity_realtime.sql` (columns + realtime publication)

Admin/dev/developer roles only (same as Creator CRM page).

## Edge worker cron (pg_cron)

Prereq: enable **pg_cron** and **pg_net** under Dashboard → Integrations (do not `CREATE EXTENSION` in SQL on hosted projects).

Migration `20260605120000_creator_pipeline_edge_cron.sql` schedules both workers every **2 minutes**:

| Job name | Edge function |
|----------|----------------|
| `creator-pipeline-quick-add` | `process-creator-quick-add` |
| `creator-pipeline-outreach-sends` | `process-creator-outreach-sends` |

Apply the migration (`supabase db push` or run in SQL editor), then create Vault secrets once:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url', 'Supabase project URL');
select vault.create_secret('YOUR_CREATOR_OUTREACH_CRON_SECRET', 'creator_outreach_cron_secret', 'Pipeline edge cron auth');
```

Use the same `CREATOR_OUTREACH_CRON_SECRET` value as Vercel and `supabase secrets set CREATOR_OUTREACH_CRON_SECRET=...` on Edge.

If cron fails with “configure vault secrets”, run `scripts/setup-cron-vault.sql` and apply migration `20260610140000_creator_pipeline_cron_vault_grants.sql`.

Inspect jobs: Dashboard → Integrations → Cron, or `select * from cron.job where jobname like 'creator-pipeline-%';`

Unschedule:

```sql
select cron.unschedule('creator-pipeline-quick-add');
select cron.unschedule('creator-pipeline-outreach-sends');
```

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
