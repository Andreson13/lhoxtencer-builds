-- Per-user permission overrides + performance indexes

-- -------------------------------------------------------
-- 1) True per-user permission overrides
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "manage_user_permissions" ON public.user_permissions;

CREATE POLICY "read_user_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    OR public.is_super_admin()
  );

CREATE POLICY "manage_user_permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  );

-- -------------------------------------------------------
-- 2) Performance indexes for daily logs / police register / billing
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stays_hotel_status_checkin_checkout
  ON public.stays(hotel_id, status, check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_stays_hotel_guest_created
  ON public.stays(hotel_id, guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siestes_hotel_arrival
  ON public.siestes(hotel_id, arrival_date DESC);

CREATE INDEX IF NOT EXISTS idx_main_courante_hotel_journee_guest
  ON public.main_courante(hotel_id, journee, guest_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_created
  ON public.invoice_items(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_created
  ON public.payments(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session_created
  ON public.cash_movements(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_hotel_date_status
  ON public.expenses(hotel_id, expense_date DESC, approval_status, payment_method);

-- -------------------------------------------------------
-- 3) Enable team management by hotel admins/managers
-- -------------------------------------------------------
DROP POLICY IF EXISTS "insert_hotel_memberships" ON public.hotel_memberships;
DROP POLICY IF EXISTS "update_hotel_memberships" ON public.hotel_memberships;
DROP POLICY IF EXISTS "delete_hotel_memberships" ON public.hotel_memberships;

CREATE POLICY "insert_hotel_memberships"
ON public.hotel_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  )
);

CREATE POLICY "update_hotel_memberships"
ON public.hotel_memberships
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  )
);

CREATE POLICY "delete_hotel_memberships"
ON public.hotel_memberships
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    hotel_id = public.get_user_hotel_id()
    AND public.get_user_role() IN ('admin', 'manager')
  )
);
