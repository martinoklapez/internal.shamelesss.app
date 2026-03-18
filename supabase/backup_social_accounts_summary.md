# Social accounts in backup (2026-03-10 00:51)

From backup file: `db_cluster-10-03-2026@00-51-02.backup`

**Total rows in backup: 15**

| device_id | platform | username       | status   | name          |
|-----------|----------|----------------|----------|---------------|
| 6         | TikTok   | starboynotes0  | draft    | StarboyNotes  |
| 7         | TikTok   | blondesaweetie| draft    | CleanGirlDiary|
| 2         | TikTok   | xafterhours0   | archived | xAfterHours   |
| 2         | TikTok   | evantyler5     | archived | Evan          |
| 2         | Snapchat | shamelesssapp  | archived | (null)        |
| 2         | TikTok   | dewydiary1     | archived | DewyDiary     |
| 2         | TikTok   | mycleandiaries1| draft    | (null)        |
| 2         | TikTok   | Ai Girl 1      | draft    | (null)        |
| 2         | TikTok   | Downforpuhh    | draft    | Major Down    |
| 6         | TikTok   | thoughtsbyava  | draft    | ava           |
| 6         | TikTok   | lunartthoughts | draft    | DreamLure     |
| 6         | TikTok   | valeriasthoughtss | draft | Valeria       |
| 6         | TikTok   | couplesdiary   | draft    | (null)        |
| 7         | TikTok   | femininejournall | draft  | Annabelle     |
| 7         | TikTok   | noahgympage    | draft    | noah          |

**Full COPY data (including credentials)** was extracted to `supabase/backup_social_accounts_copy.txt` (this file is gitignored).

## How to restore missing rows

1. **Compare with current DB**  
   Run `diagnose_social_accounts.sql` section 5 to list current `social_accounts`. Compare IDs or (device_id, platform, username) with the table above to see which rows are missing.

2. **Restore via COPY (same schema)**  
   If your current DB is missing rows and the table schema matches the backup (same columns), you can re-import the COPY block into a temporary table, then insert only the missing rows:

   - In Supabase SQL Editor, create a temp table with the same structure as `internal.social_accounts`.
   - Use `\copy` or run the contents of `backup_social_accounts_copy.txt` in a session that can run COPY (Supabase dashboard may not allow COPY FROM stdin; in that case use the INSERT approach below).

3. **Restore via INSERT (manual)**  
   Convert the COPY file to INSERTs (e.g. with a small script), then run:

   ```sql
   INSERT INTO internal.social_accounts (id, device_id, platform, username, credentials, status, created_at, updated_at, name, batch_id)
   VALUES
     ('5e16eca6-1a05-4a7b-90ec-635014da5c8c', 6, 'TikTok', 'starboynotes0', '...', 'planned', ...),
     ...
   ON CONFLICT (id) DO NOTHING;
   ```

   Use `ON CONFLICT (id) DO NOTHING` so existing rows are not overwritten. Map old `draft` to `planned` if you already ran the status migration.

**Note:** The backup uses `internal.social_accounts` and enum `internal.social_account_status` with value `draft`. If you have since added `planned` and migrated draft→planned, use `planned` when re-inserting.
