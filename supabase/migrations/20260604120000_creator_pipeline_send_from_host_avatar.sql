-- Host photo for {{book_meeting}} cards in outreach emails (Pipeline → Senders).

ALTER TABLE creator_pipeline.send_from_addresses
  ADD COLUMN IF NOT EXISTS host_avatar_url text NULL;
