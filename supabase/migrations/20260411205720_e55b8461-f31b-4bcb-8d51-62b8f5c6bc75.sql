
-- 1. Create stays table
CREATE TABLE public.stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  guest_id uuid REFERENCES public.guests(id) NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id),
  stay_type text NOT NULL DEFAULT 'night',
  room_id uuid REFERENCES public.rooms(id),
  check_in_date timestamptz,
  check_out_date timestamptz,
  actual_check_out timestamptz,
  number_of_nights integer,
  number_of_adults integer DEFAULT 1,
  number_of_children integer DEFAULT 0,
  arrangement text,
  price_per_night numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  status text DEFAULT 'active',
  invoice_id uuid REFERENCES public.invoices(id),
  receptionist_id uuid REFERENCES public.profiles(id),
  receptionist_name text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_by_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "read_stays" ON public.stays
  FOR SELECT TO authenticated
  USING ((hotel_id = get_user_hotel_id()) OR is_super_admin());

CREATE POLICY "insert_stays" ON public.stays
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY "update_stays" ON public.stays
  FOR UPDATE TO authenticated
  USING (hotel_id = get_user_hotel_id());

CREATE POLICY "delete_stays" ON public.stays
  FOR DELETE TO authenticated
  USING ((hotel_id = get_user_hotel_id()) AND (get_user_role() = ANY (ARRAY['admin'::text, 'manager'::text])));

-- 4. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stays;

-- 5. Room status sync trigger
CREATE OR REPLACE FUNCTION public.sync_room_status_from_stay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND new.status = 'active') THEN
    IF new.room_id IS NOT NULL THEN
      UPDATE public.rooms SET status = 'occupied' WHERE id = new.room_id;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND new.status = 'checked_out' AND old.status = 'active' THEN
    IF new.room_id IS NOT NULL THEN
      UPDATE public.rooms SET status = 'housekeeping' WHERE id = new.room_id;
      INSERT INTO public.housekeeping_tasks (hotel_id, room_id)
      VALUES (new.hotel_id, new.room_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER on_stay_change
  AFTER INSERT OR UPDATE ON public.stays
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_status_from_stay();

-- 6. Add created_by columns where missing
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.siestes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.siestes ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by_name text;
