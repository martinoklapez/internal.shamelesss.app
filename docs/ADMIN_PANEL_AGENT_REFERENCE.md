# Admin Panel Agent Reference: Demo Re-engagement

Reference for agents building the admin panel for demo re-engagement campaigns.

**Architektur:** Siehe `docs/DEMO_REENGAGEMENT_ARCHITECTURE.md` für den Gesamtablauf und die Tabellen.

---

## 1. Data Source

- **Table:** `demo_reengagement_campaigns` (one row per campaign)
- **Columns:** `id`, `name`, `enabled`, `trigger`, `time_config` (JSONB), `skip_if_subscribed`, `run_once_per_user`, `delay_seconds`, `delay_between_slots_seconds`, `target_selection` (JSONB), `rate_limit_hours`, `max_requests_per_user_per_day`, `requests_per_trigger`, `min_days_since_signup`, `exclude_promoter`, `include_message`, `message_template`, `created_at`, `updated_at`

Each row is one campaign. Query: `SELECT * FROM demo_reengagement_campaigns ORDER BY created_at`.

---

## 2. Campaign Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | — | Unique campaign ID |
| `name` | string | yes | — | Display name |
| `enabled` | boolean | yes | true | Whether campaign is active |
| `trigger` | enum | yes | — | `app_close`, `conversion_complete`, `purchase_pro`, `time_relative`, `time_absolute` |
| `time_config` | object | when time-based | — | Config when `trigger` is `time_relative` or `time_absolute` (see §4.5) |
| `skip_if_subscribed` | boolean | yes | true | Skip if user has active subscription |
| `run_once_per_user` | boolean | no | true | Campaign runs at most once per user |
| `delay_seconds` | number | yes | 0 | Delay before processing (0 = immediate) |
| `delay_between_slots_seconds` | number | no | 0 | **Default delay in seconds between slots.** Used when a slot has no `delay_after_seconds`. |
| `target_selection` | object | yes | — | Target selection config |
| `rate_limit_hours` | number | yes | 24 | Rate limit window |
| `max_requests_per_user_per_day` | number | yes | 1 | Max requests per user per window (per campaign) |
| `requests_per_trigger` | number | yes | 1 | Max requests per trigger |
| `min_days_since_signup` | number | yes | 0 | Min days since signup |
| `exclude_promoter` | boolean | yes | true | Skip promoter users |
| `include_message` | boolean | yes | false | Include message in requests |
| `message_template` | string \| null | yes | null | Default message template |

---

## 3. Per-Slot Delay (Different Delay Between Each Account)

You can set a **different delay between each account** (each flow slot).

### Campaign-level fallback: `delay_between_slots_seconds`

- **Default** delay between slots when a slot has no `delay_after_seconds`.
- If all slots omit `delay_after_seconds`, this value applies uniformly.

### Per-slot override: `delay_after_seconds` (on each FlowSlot)

- **Delay in seconds before the next slot runs** after this slot.
- Overrides `delay_between_slots_seconds` for this slot.
- Slot 0's `delay_after_seconds` = delay before slot 1 runs.
- Slot 1's `delay_after_seconds` = delay before slot 2 runs.
- The last slot's `delay_after_seconds` is unused (no next slot).

**Behavior:**

- **No per-slot delays:** Use `delay_between_slots_seconds` uniformly (or 0).
- **Per-slot delays:** Each slot uses its own `delay_after_seconds`; if unset, falls back to `delay_between_slots_seconds`.

**Example – different delays per account:**

| Slot | Account | delay_after_seconds | Scheduled at (trigger + delay_seconds = 60) |
|------|---------|--------------------|-------------------------------------------|
| 0    | User A  | 30                 | 60 s                                      |
| 1    | User B  | 60                 | 90 s (60 + 30)                            |
| 2    | User C  | 45                 | 150 s (90 + 60)                           |
| 3    | User D  | —                  | 195 s (150 + 45)                          |

**Applies to:** Direct mode only when flow slots exist. Ignored for demographics mode.

---

## 4. Target Selection

### `allowed_demo_user_ids` – Sender einschränken (für alle Trigger)

- **Typ:** `string[]` (Array von user_id)
- **Leer/undefined:** Alle Demo-Accounts dürfen Friend Requests senden
- **Gesetzt:** Nur diese Accounts dürfen senden – gilt für **alle** Trigger (app_close, time_relative, time_absolute, etc.)
- **Empfänger:** Immer alle berechtigten Nutzer (unverändert)
- **Zweck:** Friend Requests kommen nur von ausgewählten Accounts, nicht von beliebigen Demo-Accounts

```json
{
  "mode": "demographics",
  "allowed_demo_user_ids": ["uuid-1", "uuid-2"],
  "gender_mode": "all_opposite",
  "gender_opposite_percentage": 0.5,
  "country_match": false
}
```

**Admin UI:** Multi-Select „Sender: nur diese Accounts (leer = alle)“ – Demo-Accounts antippen zum Auswählen/Abwählen.

### Mode: `direct`

Uses ordered flow slots (Slot 1, 2, 3…). Each slot has **separate accounts for male and female targets** – you choose which demo account sends the friend request when the target user is male, and which when the target is female.

```json
{
  "mode": "direct",
  "allowed_demo_user_ids": ["uuid-1", "uuid-2"],
  "flow_slots": [
    {
      "demo_user_id": "uuid",
      "demo_user_id_male": "uuid",
      "demo_user_id_female": "uuid",
      "message": "Optional custom message per slot",
      "fallback": { "gender": "opposite" | "same" | "male" | "female" | "any" },
      "delay_after_seconds": 30
    }
  ]
}
```

**Per-slot fields:**

| Field | Type | Description |
|-------|------|-------------|
| `demo_user_id_male` | string | Account to use when **target user is male** |
| `demo_user_id_female` | string | Account to use when **target user is female** |
| `demo_user_id` | string | Legacy/fallback: used when no gender-specific, or when target has no gender |
| `message` | string | Optional custom message for this slot |
| `fallback` | object | If primary account unavailable, pick from pool by gender |
| `delay_after_seconds` | number | Delay before next slot runs |

**Resolution logic:**
- Target male → use `demo_user_id_male` ?? `demo_user_id`
- Target female → use `demo_user_id_female` ?? `demo_user_id`
- Target has no/unknown gender → use `demo_user_id` ?? `demo_user_id_male` ?? `demo_user_id_female`

- **Demo users:** `user_roles.role = 'demo'`
- **Fallback:** If primary demo user is unavailable, pick from pool by gender.
- **delay_after_seconds:** Delay before the next slot runs. Overrides campaign `delay_between_slots_seconds` for this slot.

### Mode: `demographics`

```json
{
  "mode": "demographics",
  "allowed_demo_user_ids": ["uuid-1"],
  "gender_mode": "any" | "all_opposite" | "all_same" | "random" | "percentage",
  "gender_opposite_percentage": 0.5,
  "country_match": false
}
```

---

## 5. Time-Based Triggers

### `time_relative` – Per-user timeline (days after signup)

```json
{
  "trigger": "time_relative",
  "time_config": {
    "days_after_signup": 3,
    "recurrence_interval_days": 2
  }
}
```

- **days_after_signup:** Run X days after user signed up.
- **recurrence_interval_days:** Optional. If set, run again every N days. Omit for one-time.
- **Processing:** Cron runs `process_time_based` every minute. Finds users where `created_at + days_after_signup <= now()`. For recurring, checks `demo_reengagement_last_run`.

### `time_absolute` – Fixed day/time for all users

```json
{
  "trigger": "time_absolute",
  "time_config": {
    "day_of_week": 5,
    "hour": 18,
    "minute": 0,
    "timezone": "Europe/Berlin"
  }
}
```

- **day_of_week:** 0=Sun, 1=Mon, …, 6=Sat.
- **hour:** 0–23.
- **minute:** 0–59.
- **timezone:** IANA timezone (e.g. `Europe/Berlin`). Stored as UTC in DB; default `UTC`.
- **Processing:** Cron runs every minute. When current time in timezone matches (day, hour, minute), finds eligible users and schedules. **1-minute grace window** so a run at :00 can catch the configured minute.
- **Admin UI:** „Set to now (TZ)“ Button setzt Tag/Stunde/Minute auf aktuelle Zeit (Berlin) – für Tests. Dann „Process time-based now“ ausführen.

---

## 6. Admin UI

### Sender: nur diese Accounts (allowed_demo_user_ids)

- **Label:** „Sender: nur diese Accounts (leer = alle)“
- **Input:** Multi-Select – Liste aller Demo-Accounts (aus `user_roles` + `profiles`), antippen zum Auswählen
- **Verhalten:** Ausgewählte Accounts = nur diese dürfen senden. Keine Auswahl = alle Demo-Accounts
- **Zeigen:** Für alle Kampagnen (alle Trigger, alle Modi)
- **Speichern:** `target_selection.allowed_demo_user_ids` als Array oder `undefined` wenn leer

### Campaign-level: Delay between slots (fallback)

- **Label:** "Delay between slots (sec)" or "Default delay between slots (sec)"
- **Input:** Numeric, ≥ 0
- **Placeholder:** `0`
- **Help text:** "Default delay between slots. Used when a slot has no per-slot delay."
- **Show when:** `target_selection.mode === 'direct'` and `flow_slots.length > 0`

### Per-slot: Male / Female account

- **Labels:** "Male:" and "Female:"
- **Input:** Picker/dropdown for each – select which demo account sends the friend request when the target user is male, and which when the target is female.
- **Same row:** Both pickers appear in the same slot row. You can choose the same account for both (e.g. unisex account) or different accounts.
- **Show when:** Inside each flow slot in direct mode

### Per-slot: Delay after (sec)

- **Label:** "Delay after (sec)" or "Delay before next slot (sec)"
- **Input:** Numeric, ≥ 0, optional (empty = use campaign default)
- **Placeholder:** Campaign `delay_between_slots_seconds` or `0`
- **Help text:** "Seconds to wait before the next account sends. Overrides campaign default for this slot."
- **Show when:** Inside each flow slot in direct mode

### Add slot

- **Button:** "+ Add slot"
- **Action:** Adds a new empty slot. User then selects male and female accounts for that slot.

---

## 7. `scheduled_demo_requests` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Target user |
| `campaign_id` | text | Campaign ID |
| `trigger` | text | Trigger type |
| `has_active_subscription` | boolean | User subscription status |
| `scheduled_at` | timestamptz | When to process |
| `claimed_at` | timestamptz | When claimed by cron worker |
| `slot_index` | integer | Nullable; when set, only that flow slot is processed |

- **`slot_index`:** Used when per-slot delays are configured (campaign `delay_between_slots_seconds` or any slot `delay_after_seconds`). Each row represents one slot (one friend request) at its own scheduled time.
- Cron workers invoke the edge function with `process_scheduled: true` to process due rows.

---

## 8. Run Once Per User with Delay Between Slots

- `demo_reengagement_completed` tracks which users have completed a campaign.
- **Completion is recorded only when the last slot is processed.**
- Slots 0, 1, …, N-2 are processed without marking completed.
- Slot N-1 (last) is processed and marks the campaign as completed for that user.

---

## 9. Demo Users

- **Source:** `user_roles` where `role = 'demo'`
- **Profile:** `profiles` (`user_id`, `name`, `username`, `gender`, `country_code`)

---

## 10. API / Service

- **Read:** `getDemoReengagementConfig()` from `lib/database/demo-reengagement-config.ts`
- **Write:** `updateDemoReengagementConfig({ campaigns })` in the same module
- **Storage:** `demo_reengagement_campaigns` table (one row per campaign)

---

## 11. Summary for Admin Panel

1. **Campaign list:** Add/edit/remove campaigns.
2. **Sender restriction:** `allowed_demo_user_ids` – Multi-Select „Sender: nur diese Accounts“. Leer = alle Demo-Accounts. Gesetzt = nur diese senden. Gilt für alle Trigger.
3. **Per campaign:** All fields above, including `delay_between_slots_seconds` (fallback for slots).
4. **Direct mode:** Flow slots with **male/female account per slot** – `demo_user_id_male`, `demo_user_id_female`, plus `message`, `fallback`, and `delay_after_seconds`.
5. **Per-slot male/female:** Two pickers per slot: "Male:" (account when target is male) and "Female:" (account when target is female). Both in the same row.
6. **Add slot:** "+ Add slot" button adds an empty slot; user then selects male and female accounts.
7. **Per-slot delay:** "Delay after (sec)" input. Empty = use campaign `delay_between_slots_seconds`.
8. **Campaign default delay:** "Delay between slots (sec)" – used when a slot has no `delay_after_seconds`.
9. **Demo users:** List from `user_roles` + `profiles` for slot pickers and sender multi-select.
10. **Time-based triggers:** `time_relative` (days after signup, optional recurrence) and `time_absolute` (fixed day/hour/minute/timezone). Require `process_time_based` cron. **Max 20 users per run.**
