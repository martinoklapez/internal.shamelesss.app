# Admin Panel: Campaign Storage Change

## Summary

Campaigns are no longer stored in a single JSONB config row. They now use a dedicated table with one row per campaign.

### Before (deprecated)

- **Table:** `demo_reengagement_config`
- **Row:** `id = 'default'`
- **Column:** `config` (JSONB) with a `campaigns` array
- **Read:** `SELECT config FROM demo_reengagement_config WHERE id = 'default'`
- **Write:** `UPDATE demo_reengagement_config SET config = $json WHERE id = 'default'`

### After (current)

- **Table:** `demo_reengagement_campaigns`
- **Structure:** One row per campaign
- **Read:** `SELECT * FROM demo_reengagement_campaigns ORDER BY created_at`
- **Write:** Upsert/delete rows in `demo_reengagement_campaigns`

---

## Table schema: `demo_reengagement_campaigns`

| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | Campaign ID |
| name | text | Display name |
| enabled | boolean | Whether campaign is active |
| trigger | text | `app_close`, `conversion_complete`, `purchase_pro`, `time_relative`, `time_absolute` |
| time_config | jsonb | Config for time_relative or time_absolute |
| skip_if_subscribed | boolean | Skip if user has active subscription |
| run_once_per_user | boolean | Run at most once per user |
| delay_seconds | integer | Delay before processing (0 = immediate) |
| delay_between_slots_seconds | integer | Default delay between flow slots |
| target_selection | jsonb | Direct or demographics config (flow_slots, demographics) |
| rate_limit_hours | integer | Rate limit window |
| max_requests_per_user_per_day | integer | Max requests per user per window |
| requests_per_trigger | integer | Max requests per trigger |
| min_days_since_signup | integer | Min days since signup |
| exclude_promoter | boolean | Skip promoter users |
| include_message | boolean | Include message in requests |
| message_template | text | Default message template |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update time |

---

## Admin panel / DB usage

- **List campaigns:** `SELECT * FROM demo_reengagement_campaigns ORDER BY created_at ASC`
- **Get one campaign:** `SELECT * FROM demo_reengagement_campaigns WHERE id = $id`
- **Create campaign:** `INSERT INTO demo_reengagement_campaigns (id, name, enabled, trigger, ...) VALUES (...)`
- **Update campaign:** `UPDATE demo_reengagement_campaigns SET name = $name, ... WHERE id = $id`
- **Delete campaign:** `DELETE FROM demo_reengagement_campaigns WHERE id = $id`
- **Filter campaigns:** e.g. by trigger `WHERE trigger = 'time_relative'`, by enabled `WHERE enabled = true`

---

## JSONB columns

**time_config**

- `time_relative`: `{ days_after_signup, recurrence_interval_days? }`
- `time_absolute`: `{ day_of_week, hour, minute, timezone? }`

**target_selection**

- Direct: `{ mode: 'direct', flow_slots: [...] }`
- Demographics: `{ mode: 'demographics', gender_mode, gender_opposite_percentage, country_match }`

---

## Migration

Existing campaigns were migrated from `demo_reengagement_config.config->campaigns` into `demo_reengagement_campaigns`. The migration is in `supabase/migrations/create_demo_reengagement_campaigns.sql`. The old config table is no longer used for campaigns (the app still falls back to reading it if the new table is empty).

---

## API / service (unchanged)

- **Read:** `getDemoReengagementConfig()` → `{ campaigns: Campaign[] }`
- **Write:** `updateDemoReengagementConfig({ campaigns })`

The service reads from and writes to `demo_reengagement_campaigns` instead of `demo_reengagement_config`. The public API stays the same.
