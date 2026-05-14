-- Allow hotel admins/managers to delete staff members from their hotel

-- Update profiles update policy to allow admins to disable staff (set hotel_id to null)
DROP POLICY IF EXISTS "Admins update hotel profiles" ON public.profiles;
CREATE POLICY "Admins update hotel profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager')
)
WITH CHECK (
  -- Allow updates if the profile's hotel matches user's hotel (normal update)
  -- OR allow nullifying hotel_id when disabling staff (removal)
  hotel_id = public.get_user_hotel_id() OR hotel_id IS NULL
);

-- Update hotel_memberships delete policy to allow hotel admins and managers
DROP POLICY IF EXISTS "delete_hotel_memberships" ON public.hotel_memberships;
CREATE POLICY "delete_hotel_memberships"
ON public.hotel_memberships
FOR DELETE
TO authenticated
USING (
  public.is_super_admin() OR
  (
    hotel_id = public.get_user_hotel_id() AND
    public.get_user_role() IN ('admin', 'manager')
  )
);
