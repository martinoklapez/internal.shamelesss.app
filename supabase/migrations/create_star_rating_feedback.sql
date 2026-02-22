-- Star rating feedback table (e.g. from in-app rate flow)
-- Create only if not exists so it's safe to run after manual creation
CREATE TABLE IF NOT EXISTS public.star_rating_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  star_rating integer NOT NULL,
  feedback_text text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT star_rating_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT star_rating_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT star_rating_feedback_star_rating_check CHECK (
    (star_rating >= 1 AND star_rating <= 5)
  )
) TABLESPACE pg_default;

-- RLS: allow read for authenticated users (admin/dev/developer via app checks)
ALTER TABLE public.star_rating_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: allow select for authenticated users (app enforces role on API)
CREATE POLICY "Allow authenticated read" ON public.star_rating_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- No insert/update/delete from dashboard; app writes from client
CREATE POLICY "Allow authenticated insert" ON public.star_rating_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role can do anything (e.g. migrations)
-- No additional policy needed for anon; dashboard uses authenticated.

COMMENT ON TABLE public.star_rating_feedback IS 'In-app star rating and optional feedback (e.g. rate flow 1-5 stars).';
