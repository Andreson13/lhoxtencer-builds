-- Policies for stock_movements (skip if already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='insert_stock_movements') THEN
    CREATE POLICY "insert_stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (hotel_id = get_user_hotel_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='read_stock_movements') THEN
    CREATE POLICY "read_stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (hotel_id = get_user_hotel_id() OR is_super_admin());
  END IF;
END $$;

-- Ensure the trigger exists on stays
DROP TRIGGER IF EXISTS on_stay_change ON public.stays;
CREATE TRIGGER on_stay_change
  AFTER INSERT OR UPDATE ON public.stays
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_status_from_stay();