-- Position diary + optional memory images per diary entry

CREATE OR REPLACE FUNCTION public.update_position_diary_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TABLE public.position_diary (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL,
  position_id text NOT NULL,
  rating integer NULL,
  feeling_for_her text NULL,
  feeling_for_him text NULL,
  notes text NULL,
  worth_repeat boolean NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  memory_image_path text NULL,
  CONSTRAINT position_diary_pkey PRIMARY KEY (id),
  CONSTRAINT position_diary_user_id_position_id_key UNIQUE (user_id, position_id),
  CONSTRAINT position_diary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT position_diary_rating_check CHECK (
    rating IS NULL OR ((rating >= 1) AND (rating <= 5))
  )
);

CREATE INDEX IF NOT EXISTS idx_position_diary_user_id ON public.position_diary USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_position_diary_position_id ON public.position_diary USING btree (position_id);

DROP TRIGGER IF EXISTS update_position_diary_updated_at ON public.position_diary;

CREATE TRIGGER update_position_diary_updated_at
  BEFORE UPDATE ON public.position_diary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_position_diary_updated_at ();

CREATE TABLE public.diary_memory_images (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  diary_entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  memory_image_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  is_visible boolean NOT NULL DEFAULT true,
  CONSTRAINT diary_memory_images_pkey PRIMARY KEY (id),
  CONSTRAINT diary_memory_images_diary_entry_id_memory_image_path_key UNIQUE (diary_entry_id, memory_image_path),
  CONSTRAINT diary_memory_images_diary_entry_id_fkey FOREIGN KEY (diary_entry_id) REFERENCES public.position_diary (id) ON DELETE CASCADE,
  CONSTRAINT diary_memory_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diary_memory_images_diary_entry_id ON public.diary_memory_images USING btree (diary_entry_id);

CREATE INDEX IF NOT EXISTS idx_diary_memory_images_user_id ON public.diary_memory_images USING btree (user_id);
