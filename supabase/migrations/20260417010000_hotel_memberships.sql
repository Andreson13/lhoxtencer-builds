-- Multi-hotel memberships for users (a user can manage multiple hotels)
CREATE TABLE IF NOT EXISTS public.hotel_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'receptionist',
  is_hotel_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, user_id)
);

ALTER TABLE public.hotel_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_hotel_memberships" ON public.hotel_memberships;
CREATE POLICY "read_hotel_memberships"
ON public.hotel_memberships
FOR SELECT
TO authenticated
USING (public.is_super_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "insert_hotel_memberships" ON public.hotel_memberships;
CREATE POLICY "insert_hotel_memberships"
ON public.hotel_memberships
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_hotel_memberships" ON public.hotel_memberships;
CREATE POLICY "update_hotel_memberships"
ON public.hotel_memberships
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "delete_hotel_memberships" ON public.hotel_memberships;
CREATE POLICY "delete_hotel_memberships"
ON public.hotel_memberships
FOR DELETE
TO authenticated
USING (public.is_super_admin());
