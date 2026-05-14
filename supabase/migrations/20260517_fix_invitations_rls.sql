-- Drop existing problematic policies
DROP POLICY IF EXISTS "read_own_hotel_invitations" ON public.invitations;
DROP POLICY IF EXISTS "create_hotel_invitations" ON public.invitations;
DROP POLICY IF EXISTS "update_hotel_invitations" ON public.invitations;
DROP POLICY IF EXISTS "user_view_own_invitations" ON public.invitations;
DROP POLICY IF EXISTS "user_accept_reject_invitations" ON public.invitations;

-- Create simplified RLS policies

-- Policy 1: Admins/Managers can view invitations for their hotels
CREATE POLICY "admin_view_hotel_invitations"
ON public.invitations FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.hotel_memberships
    WHERE hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);

-- Policy 2: Admins/Managers can create/insert invitations
CREATE POLICY "admin_create_invitations"
ON public.invitations FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.hotel_memberships
    WHERE hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);

-- Policy 3: Admins/Managers can delete/update invitations
CREATE POLICY "admin_update_invitations"
ON public.invitations FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.hotel_memberships
    WHERE hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.hotel_memberships
    WHERE hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);

-- Policy 4: Admins/Managers can delete invitations
CREATE POLICY "admin_delete_invitations"
ON public.invitations FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.hotel_memberships
    WHERE hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);

-- Policy 5: Users can view their own invitations by email (for signup flow)
CREATE POLICY "user_view_own_pending_invitations"
ON public.invitations FOR SELECT
USING (
  email = (auth.jwt() ->> 'email')
);

-- Policy 6: Users can update their own invitations (accept/reject)
CREATE POLICY "user_update_own_invitations"
ON public.invitations FOR UPDATE
USING (
  email = (auth.jwt() ->> 'email')
)
WITH CHECK (
  email = (auth.jwt() ->> 'email')
);
