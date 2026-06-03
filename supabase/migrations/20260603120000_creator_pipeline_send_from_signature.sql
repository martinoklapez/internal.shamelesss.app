-- HTML email signature appended to outreach template body (from Missive signature export).

ALTER TABLE creator_pipeline.send_from_addresses
  ADD COLUMN IF NOT EXISTS signature_html text NULL;

COMMENT ON COLUMN creator_pipeline.send_from_addresses.signature_html IS
  'HTML signature appended after the outreach template body on Missive send.';
