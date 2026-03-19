-- Push notification content templates for send-push-notifications Edge Function
-- Admin panel can manage title/body templates per notification_type

CREATE TABLE IF NOT EXISTS public.notification_content_templates (
  notification_type text PRIMARY KEY,
  title_template text NOT NULL DEFAULT '',
  body_template text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_content_templates IS 'Templates for push notification title/body; Edge Function reads these to override job defaults.';

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_notification_content_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_content_templates_updated_at ON public.notification_content_templates;
CREATE TRIGGER notification_content_templates_updated_at
  BEFORE UPDATE ON public.notification_content_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_content_templates_updated_at();

-- RLS: read for authenticated; write for admin/developer
ALTER TABLE public.notification_content_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read notification_content_templates" ON public.notification_content_templates;
CREATE POLICY "Allow authenticated read notification_content_templates"
  ON public.notification_content_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin developer write notification_content_templates" ON public.notification_content_templates;
CREATE POLICY "Allow admin developer write notification_content_templates"
  ON public.notification_content_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'dev', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'dev', 'developer')
    )
  );

-- Seed default templates
INSERT INTO public.notification_content_templates (notification_type, title_template, body_template)
VALUES
  ('friend_request', '✨ New Friend Request', '{sender_name} wants to connect!'),
  ('friend_request_accepted', '🎉 You''re now friends!', '{recipient_name} accepted your request - start chatting!'),
  ('message', '{sender_name}', '{message_preview}')
ON CONFLICT (notification_type) DO NOTHING;
