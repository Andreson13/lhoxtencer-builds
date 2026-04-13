-- Link hotel photos to room categories for true category-specific media in booking portal
ALTER TABLE public.hotel_photos
ADD COLUMN IF NOT EXISTS category_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hotel_photos_category_id_fkey'
      AND conrelid = 'public.hotel_photos'::regclass
  ) THEN
    ALTER TABLE public.hotel_photos
    ADD CONSTRAINT hotel_photos_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.room_categories(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hotel_photos_category_id
  ON public.hotel_photos(category_id);

CREATE INDEX IF NOT EXISTS idx_hotel_photos_hotel_category_order
  ON public.hotel_photos(hotel_id, category_id, display_order);
