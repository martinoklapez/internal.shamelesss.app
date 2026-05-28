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

## 3-way associations

| Table | Role |
|-------|------|
| `creators` | Person |
| `profiles` | Social account (no `creator_id` column) |
| `contacts` | Rep / direct inbox (no `creator_id` column) |
| **`associations`** | Links `creator_id` + optional `profile_id` + optional `contact_id` |

From any entity:

- **Creator** → `associations` where `creator_id = ?` → profile + contact ids
- **Profile** → row where `profile_id = ?` → `creator_id`, then other rows for same creator
- **Contact** → row where `contact_id = ?` → `creator_id`, then other rows for same creator

## Other tables

- `email_templates` — Templates page
- `email_touchpoints`, `outreach_sends`, `activity_events` — Log / outreach

## App API

- `GET /api/creator-pipeline` — load full store
- `POST /api/creator-pipeline/mutate` — mutations (`replaceStore`, `scoutProfile`, …)

Admin/dev/developer roles only (same as Creator CRM page).
