
-- Fix restaurant_orders: drop duplicate policies and recreate clean ones
DROP POLICY IF EXISTS "insert_restaurant_orders" ON public.restaurant_orders;
DROP POLICY IF EXISTS "public_insert_orders" ON public.restaurant_orders;

-- Single clear public insert policy (for QR menu orders)
CREATE POLICY "anyone_can_insert_orders" ON public.restaurant_orders
  FOR INSERT TO public WITH CHECK (true);

-- Fix restaurant_order_items: ensure public can read their order items
DROP POLICY IF EXISTS "public_read_order_items" ON public.restaurant_order_items;
CREATE POLICY "public_read_order_items" ON public.restaurant_order_items
  FOR SELECT TO public USING (true);

-- Add category_id to reservations for category-based booking
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.room_categories(id);

-- Add guest_id to reservations to link to existing guest records
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.guests(id);

-- Ensure stock_movements has proper RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_stock_movements" ON public.stock_movements;
CREATE POLICY "insert_stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (hotel_id = get_user_hotel_id());

DROP POLICY IF EXISTS "read_stock_movements" ON public.stock_movements;
CREATE POLICY "read_stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (hotel_id = get_user_hotel_id() OR is_super_admin());

-- Ensure stock_entries can be deleted by admin
DROP POLICY IF EXISTS "delete_stock_entries" ON public.stock_entries;
CREATE POLICY "delete_stock_entries" ON public.stock_entries
  FOR DELETE TO authenticated USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('admin', 'manager'));
