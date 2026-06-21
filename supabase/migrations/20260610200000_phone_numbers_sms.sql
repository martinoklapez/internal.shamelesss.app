-- Twilio phone inventory + SMS inbox for device marketing stack.

CREATE TYPE public.phone_number_status AS ENUM ('active', 'reserved', 'released');
CREATE TYPE public.phone_number_purpose AS ENUM ('tiktok_signup', 'instagram_signup', 'general');
CREATE TYPE public.sms_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.sms_status AS ENUM ('received', 'queued', 'sent', 'delivered', 'failed');

CREATE TABLE public.phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  e164 text NOT NULL UNIQUE,
  twilio_sid text,
  friendly_name text,
  country text,
  status public.phone_number_status NOT NULL DEFAULT 'active',
  device_id integer,
  icloud_profile_id uuid,
  social_account_id uuid,
  batch_id uuid,
  purpose public.phone_number_purpose NOT NULL DEFAULT 'general',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_numbers_device_id_idx ON public.phone_numbers (device_id);
CREATE INDEX phone_numbers_status_idx ON public.phone_numbers (status);
CREATE INDEX phone_numbers_batch_id_idx ON public.phone_numbers (batch_id);

CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES public.phone_numbers (id) ON DELETE CASCADE,
  direction public.sms_direction NOT NULL,
  from_e164 text NOT NULL,
  to_e164 text NOT NULL,
  body text NOT NULL DEFAULT '',
  twilio_message_sid text UNIQUE,
  status public.sms_status NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sms_messages_phone_number_id_created_at_idx
  ON public.sms_messages (phone_number_id, created_at DESC);
CREATE INDEX sms_messages_unread_idx
  ON public.sms_messages (phone_number_id)
  WHERE direction = 'inbound' AND read_at IS NULL;

COMMENT ON TABLE public.phone_numbers IS
  'Twilio numbers linked to devices / identity batches for marketing signups.';
COMMENT ON TABLE public.sms_messages IS
  'Inbound and outbound SMS thread per phone number.';

-- RLS: authenticated panel users (admin, dev, developer, promoter).
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY phone_numbers_select_authenticated ON public.phone_numbers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY phone_numbers_insert_authenticated ON public.phone_numbers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY phone_numbers_update_authenticated ON public.phone_numbers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY phone_numbers_delete_authenticated ON public.phone_numbers
  FOR DELETE TO authenticated USING (true);

CREATE POLICY sms_messages_select_authenticated ON public.sms_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sms_messages_insert_authenticated ON public.sms_messages
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY sms_messages_update_authenticated ON public.sms_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Realtime for live inbox UI.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication missing — enable Realtime for public.sms_messages in Dashboard';
END $$;
