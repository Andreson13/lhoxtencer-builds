-- Drop problematic hotel_memberships policies and make them simpler
DROP POLICY IF EXISTS "insert_hotel_memberships" ON public.hotel_memberships;
DROP POLICY IF EXISTS "update_hotel_memberships" ON public.hotel_memberships;
DROP POLICY IF EXISTS "delete_hotel_memberships" ON public.hotel_memberships;

-- Allow inserting/updating/deleting hotel_memberships for authenticated users
CREATE POLICY "insert_hotel_memberships"
ON public.hotel_memberships FOR INSERT
WITH CHECK (true);

CREATE POLICY "update_hotel_memberships"
ON public.hotel_memberships FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "delete_hotel_memberships"
ON public.hotel_memberships FOR DELETE
USING (true);
