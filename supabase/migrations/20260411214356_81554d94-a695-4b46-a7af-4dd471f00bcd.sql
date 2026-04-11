
-- Create room_categories table
CREATE TABLE IF NOT EXISTS public.room_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price_per_night numeric NOT NULL DEFAULT 0,
  price_sieste numeric DEFAULT 0,
  features text[] DEFAULT '{}',
  color text DEFAULT '#6366f1',
  display_order integer DEFAULT 0,
  portal_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_room_categories" ON public.room_categories
  FOR SELECT USING (
    (hotel_id = get_user_hotel_id()) OR is_super_admin() OR (portal_visible = true)
  );

CREATE POLICY "insert_room_categories" ON public.room_categories
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "update_room_categories" ON public.room_categories
  FOR UPDATE TO authenticated
  USING (hotel_id = get_user_hotel_id());

CREATE POLICY "delete_room_categories" ON public.room_categories
  FOR DELETE TO authenticated
  USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('admin', 'manager'));

-- Add category_id to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.room_categories(id);

-- Add room_number to restaurant_orders if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='restaurant_orders' AND column_name='room_number') THEN
    ALTER TABLE public.restaurant_orders ADD COLUMN room_number text;
  END IF;
END $$;

-- Fix the trigger: drop and recreate
CREATE OR REPLACE FUNCTION public.sync_room_status_from_stay()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND new.status = 'active') OR
     (TG_OP = 'UPDATE' AND new.status = 'active' AND old.status != 'active') THEN
    IF new.room_id IS NOT NULL THEN
      UPDATE public.rooms SET status = 'occupied' WHERE id = new.room_id;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND new.status = 'checked_out' AND old.status = 'active' THEN
    IF new.room_id IS NOT NULL THEN
      UPDATE public.rooms SET status = 'housekeeping' WHERE id = new.room_id;
      INSERT INTO public.housekeeping_tasks (hotel_id, room_id)
      SELECT new.hotel_id, new.room_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.housekeeping_tasks
        WHERE room_id = new.room_id AND status != 'clean' AND created_at > now() - interval '1 day'
      );
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_stay_change ON public.stays;
CREATE TRIGGER on_stay_change
  AFTER INSERT OR UPDATE ON public.stays
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_status_from_stay();

-- Ensure housekeeping clean trigger exists
DROP TRIGGER IF EXISTS on_housekeeping_clean ON public.housekeeping_tasks;
CREATE TRIGGER on_housekeeping_clean
  AFTER UPDATE ON public.housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_room_available_on_clean();

-- Public insert policy for restaurant_orders (for QR menu)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='restaurant_orders' AND policyname='public_insert_orders') THEN
    CREATE POLICY "public_insert_orders" ON public.restaurant_orders FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Enable realtime for room_categories
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_categories;
