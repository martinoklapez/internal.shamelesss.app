# Time (absolute) trigger – why it might not run

## What this panel does

The admin panel **only stores** campaign config. It does **not** run any cron or worker. When you set a campaign to **Time (absolute)** and choose a day/time (e.g. “in 2 minutes”), that is saved in `demo_reengagement_campaigns` as UTC in `time_config` (`day_of_week`, `hour`, `minute`).

## Why “in 2 minutes” did nothing

For **time_absolute** to actually run, something **outside this repo** must:

1. **Run on a schedule** (e.g. every 1–5 minutes).
2. **Read** enabled campaigns with `trigger = 'time_absolute'` from `demo_reengagement_campaigns`.
3. **Compare** current UTC date/time (day of week, hour, minute) to each campaign’s `time_config`.
4. **For matching campaigns**, create rows in `demo_reengagement_absolute_runs` (and typically `scheduled_demo_requests`) and then process them (create friend requests, etc.).

If that scheduler/cron is missing, not deployed, or not reading from `demo_reengagement_campaigns`, nothing will happen at the scheduled time.

## Where the runner usually lives

- **Supabase**: A **pg_cron** job or a **Supabase Edge Function** invoked on a schedule (e.g. “every minute”) that reads campaigns and creates `scheduled_demo_requests` / `demo_reengagement_absolute_runs`.
- **Backend / mobile**: A separate service or cron job that calls an API or the DB and does the same.

The “demo-reengagement” **edge function** mentioned in the codebase (e.g. in migrations) is the piece that is supposed to react to **app_close** and possibly to **scheduled** runs. The **scheduler** that decides “it’s 14:00 UTC Monday, run time_absolute campaigns that match” is a different component (cron + edge function, or external cron + API).

## What to check

1. **Config is correct**  
   In the DB or in the Logs section, confirm the campaign has `trigger = 'time_absolute'`, `enabled = true`, and `time_config` with the UTC time you expect (the UI shows Berlin time but stores UTC).

2. **A scheduler exists**  
   Ask your backend/mobile team: “What runs every minute (or every N minutes) to evaluate time_absolute campaigns and create `scheduled_demo_requests` or insert into `demo_reengagement_absolute_runs`?”  
   If the answer is “nothing,” they need to add that (e.g. Supabase cron → Edge Function, or external cron hitting an API).

3. **Logs**  
   After the scheduled time, check **Logs** on this page:  
   - **Absolute runs**: rows appear when a time_absolute campaign was evaluated for a given date.  
   - **Scheduled demo requests**: rows appear when the runner scheduled work.  
   If both stay empty at and after the scheduled time, the scheduler is not running or not matching your campaign.

## Summary

**Time (absolute) does not run by itself.** This panel only saves the schedule. A separate **cron/scheduler** must run periodically, read `demo_reengagement_campaigns`, and trigger the flow. If that is not set up or not deployed, nothing will happen at the chosen time.
