
-- Security definer functions to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.get_user_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hotel_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()), false)
$$;

-- Enable RLS on ALL tables
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siestes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.main_courante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Hotels policies
CREATE POLICY "Public can read hotels" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Auth can insert hotels" ON public.hotels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can update hotel" ON public.hotels FOR UPDATE TO authenticated USING (
  id = public.get_user_hotel_id() OR public.is_super_admin()
);

-- Profiles policies
CREATE POLICY "Users read profiles" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR hotel_id = public.get_user_hotel_id() OR public.is_super_admin()
);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins update hotel profiles" ON public.profiles FOR UPDATE TO authenticated USING (
  hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager')
);
CREATE POLICY "System insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Generic hotel-scoped policies helper macro applied to each table
-- Room types
CREATE POLICY "read_room_types" ON public.room_types FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_room_types" ON public.room_types FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_room_types" ON public.room_types FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_room_types" ON public.room_types FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Rooms
CREATE POLICY "read_rooms" ON public.rooms FOR SELECT USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin() OR portal_visible = true);
CREATE POLICY "insert_rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_rooms" ON public.rooms FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_rooms" ON public.rooms FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Guests
CREATE POLICY "read_guests" ON public.guests FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_guests" ON public.guests FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_guests" ON public.guests FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_guests" ON public.guests FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Reservations
CREATE POLICY "read_reservations" ON public.reservations FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_reservations" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "update_reservations" ON public.reservations FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_reservations" ON public.reservations FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Invoices
CREATE POLICY "read_invoices" ON public.invoices FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_invoices" ON public.invoices FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Invoice items
CREATE POLICY "read_invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Payments
CREATE POLICY "read_payments" ON public.payments FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Siestes
CREATE POLICY "read_siestes" ON public.siestes FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_siestes" ON public.siestes FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_siestes" ON public.siestes FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Main courante
CREATE POLICY "read_main_courante" ON public.main_courante FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_main_courante" ON public.main_courante FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_main_courante" ON public.main_courante FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Restaurant categories
CREATE POLICY "read_restaurant_categories" ON public.restaurant_categories FOR SELECT USING (true);
CREATE POLICY "insert_restaurant_categories" ON public.restaurant_categories FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_restaurant_categories" ON public.restaurant_categories FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_restaurant_categories" ON public.restaurant_categories FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Restaurant items
CREATE POLICY "read_restaurant_items" ON public.restaurant_items FOR SELECT USING (true);
CREATE POLICY "insert_restaurant_items" ON public.restaurant_items FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_restaurant_items" ON public.restaurant_items FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_restaurant_items" ON public.restaurant_items FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Restaurant orders
CREATE POLICY "read_restaurant_orders" ON public.restaurant_orders FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_restaurant_orders" ON public.restaurant_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "update_restaurant_orders" ON public.restaurant_orders FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Restaurant order items
CREATE POLICY "read_order_items" ON public.restaurant_order_items FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_order_items" ON public.restaurant_order_items FOR INSERT WITH CHECK (true);

-- Expense categories
CREATE POLICY "read_expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_expense_categories" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_expense_categories" ON public.expense_categories FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Expenses
CREATE POLICY "read_expenses" ON public.expenses FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_expenses" ON public.expenses FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Cash sessions
CREATE POLICY "read_cash_sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_cash_sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_cash_sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Cash movements
CREATE POLICY "read_cash_movements" ON public.cash_movements FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_cash_movements" ON public.cash_movements FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Inventory categories
CREATE POLICY "read_inventory_categories" ON public.inventory_categories FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_inventory_categories" ON public.inventory_categories FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_inventory_categories" ON public.inventory_categories FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Inventory items
CREATE POLICY "read_inventory_items" ON public.inventory_items FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_inventory_items" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_inventory_items" ON public.inventory_items FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Stock entries
CREATE POLICY "read_stock_entries" ON public.stock_entries FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_stock_entries" ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Stock movements
CREATE POLICY "read_stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Housekeeping tasks
CREATE POLICY "read_housekeeping" ON public.housekeeping_tasks FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "insert_housekeeping" ON public.housekeeping_tasks FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_housekeeping" ON public.housekeeping_tasks FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Notifications
CREATE POLICY "read_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "insert_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Audit logs
CREATE POLICY "read_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager')) OR public.is_super_admin()
);
CREATE POLICY "insert_audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());

-- Hotel settings
CREATE POLICY "read_hotel_settings" ON public.hotel_settings FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "manage_hotel_settings" ON public.hotel_settings FOR ALL TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- Hotel photos & services (public read)
CREATE POLICY "public_read_photos" ON public.hotel_photos FOR SELECT USING (true);
CREATE POLICY "insert_photos" ON public.hotel_photos FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_photos" ON public.hotel_photos FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());
CREATE POLICY "delete_photos" ON public.hotel_photos FOR DELETE TO authenticated USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

CREATE POLICY "public_read_services" ON public.hotel_services FOR SELECT USING (true);
CREATE POLICY "insert_services" ON public.hotel_services FOR INSERT TO authenticated WITH CHECK (hotel_id = public.get_user_hotel_id());
CREATE POLICY "update_services" ON public.hotel_services FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

-- Service requests & feedback (public insert)
CREATE POLICY "read_service_requests" ON public.service_requests FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "public_insert_service_requests" ON public.service_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "update_service_requests" ON public.service_requests FOR UPDATE TO authenticated USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY "read_feedback" ON public.guest_feedback FOR SELECT TO authenticated USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());
CREATE POLICY "public_insert_feedback" ON public.guest_feedback FOR INSERT WITH CHECK (true);

-- TRIGGERS

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Sync hotel_id and role from invite metadata
CREATE OR REPLACE FUNCTION public.sync_profile_from_metadata()
RETURNS trigger AS $$
BEGIN
  IF new.raw_user_meta_data->>'hotel_id' IS NOT NULL THEN
    UPDATE public.profiles SET
      hotel_id = (new.raw_user_meta_data->>'hotel_id')::uuid,
      role = coalesce(new.raw_user_meta_data->>'role', 'receptionist'),
      is_hotel_owner = coalesce((new.raw_user_meta_data->>'is_hotel_owner')::boolean, false)
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_metadata_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_from_metadata();

-- Auto housekeeping on checkout
CREATE OR REPLACE FUNCTION public.create_housekeeping_on_checkout()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'checked_out' AND old.status != 'checked_out' THEN
    INSERT INTO public.housekeeping_tasks (hotel_id, room_id)
    VALUES (new.hotel_id, new.room_id)
    ON CONFLICT DO NOTHING;
    UPDATE public.rooms SET status = 'housekeeping' WHERE id = new.room_id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_guest_checkout
  AFTER UPDATE ON public.guests
  FOR EACH ROW EXECUTE PROCEDURE public.create_housekeeping_on_checkout();

-- Auto room available on clean
CREATE OR REPLACE FUNCTION public.set_room_available_on_clean()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'clean' AND old.status != 'clean' THEN
    UPDATE public.rooms SET status = 'available' WHERE id = new.room_id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_housekeeping_clean
  AFTER UPDATE ON public.housekeeping_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_room_available_on_clean();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.housekeeping_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.main_courante;
