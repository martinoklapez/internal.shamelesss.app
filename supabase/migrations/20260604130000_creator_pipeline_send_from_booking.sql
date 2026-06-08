-- Cal.com booking card settings per outreach sender (Pipeline → Senders).

ALTER TABLE creator_pipeline.send_from_addresses
  ADD COLUMN IF NOT EXISTS booking_url text NULL,
  ADD COLUMN IF NOT EXISTS booking_meeting_name text NULL,
  ADD COLUMN IF NOT EXISTS booking_meeting_type text NULL,
  ADD COLUMN IF NOT EXISTS booking_duration text NULL,
  ADD COLUMN IF NOT EXISTS booking_action_label text NULL;
