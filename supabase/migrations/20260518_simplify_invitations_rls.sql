-- Drop problematic policies
DROP POLICY IF EXISTS "admin_view_hotel_invitations" ON public.invitations;
DROP POLICY IF EXISTS "admin_create_invitations" ON public.invitations;
DROP POLICY IF EXISTS "admin_update_invitations" ON public.invitations;
DROP POLICY IF EXISTS "admin_delete_invitations" ON public.invitations;
DROP POLICY IF EXISTS "user_view_own_pending_invitations" ON public.invitations;
DROP POLICY IF EXISTS "user_update_own_invitations" ON public.invitations;

-- Simplified RLS policies

-- Policy 1: Users can view invitations for hotels where they are admin/manager
CREATE POLICY "view_invitations"
ON public.invitations FOR SELECT
USING (
  -- Admins/managers of the hotel can view
  EXISTS (
    SELECT 1 FROM public.hotel_memberships
    WHERE user_id = auth.uid()
    AND hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
  OR
  -- Users can view their own pending invitations
  email = (auth.jwt() ->> 'email')
);

-- Policy 2: Only admins/managers can insert
CREATE POLICY "create_invitations"
ON public.invitations FOR INSERT
WITH CHECK (
  invited_by IS NOT NULL
  AND invited_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.hotel_memberships
    WHERE user_id = auth.uid()
    AND hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);

-- Policy 3: Users can update their own (accept/reject), admins can update any
CREATE POLICY "update_invitations"
ON public.invitations FOR UPDATE
USING (
  -- Admins/managers can update any
  EXISTS (
    SELECT 1 FROM public.hotel_memberships
    WHERE user_id = auth.uid()
    AND hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
  OR
  -- Users can update their own pending invitations
  (email = (auth.jwt() ->> 'email') AND status = 'pending')
)
WITH CHECK (
  -- Admins/managers can update any
  EXISTS (
    SELECT 1 FROM public.hotel_memberships
    WHERE user_id = auth.uid()
    AND hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
  OR
  -- Users can only change status of their own
  (email = (auth.jwt() ->> 'email') AND status IN ('accepted', 'rejected'))
);

-- Policy 4: Only admins/managers can delete
CREATE POLICY "delete_invitations"
ON public.invitations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_memberships
    WHERE user_id = auth.uid()
    AND hotel_id = invitations.hotel_id
    AND role IN ('admin', 'manager')
  )
);
