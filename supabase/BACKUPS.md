# Checking and using Supabase backups

Supabase does **not** expose backup content from inside the database. You can’t run a SQL query to “read from backup”. Backups are full database snapshots managed by Supabase.

## Where backups are

- **Dashboard:** open your project → **Database** → **Backups**.
  - **Scheduled backups:** daily snapshots. Retention: Pro 7 days, Team 14 days, Enterprise up to 30 days.
  - **Point in Time (PITR):** if enabled, you can restore to any second within the retention window (e.g. 7 / 14 / 28 days). PITR replaces daily backups when enabled.

## How to “check” a backup

- **List backups (metadata only):** in the Dashboard under **Database → Backups** you see available backup dates/times. No way to “peek” at table rows from there.
- **See old table content:** the only way is to restore:
  - **Restore this project** to a backup (or PITR point). The whole project is replaced by that point in time; there will be downtime.
  - **Restore to a new project** (e.g. “Duplicate project” / restore to new project): creates a second project with data as of that backup. You can then run SQL in the new project to inspect `social_accounts` (or export data) without touching production.

## List backups via API

If you want to list backups programmatically (dates/times only, not table data):

```bash
# Get token: https://supabase.com/dashboard/account/tokens
# Project ref: Dashboard URL or Project Settings → General

curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/database/backups"
```

## Restoring

- **From Dashboard:** Database → Backups → choose a backup or PITR time → follow the restore flow. Confirm carefully; the project is unavailable during restore.
- **PITR restore via API:** [Management API – restore PITR](https://supabase.com/docs/reference/api/v1-restore-pitr-backup) with a Unix timestamp.

## Free tier

Free tier projects get daily backups but with limited retention. The docs recommend doing your own exports (e.g. `supabase db dump`) and keeping off-site backups if you need to recover data.

## References

- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Restore to a new project / Clone](https://supabase.com/docs/guides/platform/clone-project)
- [Management API – list backups](https://supabase.com/docs/reference/api/v1-list-all-backups)
