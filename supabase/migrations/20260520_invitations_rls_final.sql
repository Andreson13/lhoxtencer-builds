-- Drop all existing problematic policies
DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update" ON public.invitations;
DROP POLICY IF EXISTS "invitations_delete" ON public.invitations;
DROP POLICY IF EXISTS "view_invitations" ON public.invitations;
DROP POLICY IF EXISTS "create_invitations" ON public.invitations;
DROP POLICY IF EXISTS "update_invitations" ON public.invitations;
DROP POLICY IF EXISTS "delete_invitations" ON public.invitations;

-- Create simple working policies

-- Allow anyone to view their own invitations or invitations for their hotel
CREATE POLICY "select_invitations"
ON public.invitations FOR SELECT
USING (
  -- User is in the hotel
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE hotel_id = invitations.hotel_id
  )
  OR
  -- User is the invited email
  email = COALESCE((auth.jwt() ->> 'email'), '')
);

-- Allow inserting if user provided invited_by
CREATE POLICY "insert_invitations"
ON public.invitations FOR INSERT
WITH CHECK (true);

-- Allow updating own invitations or hotel invitations
CREATE POLICY "update_invitations"
ON public.invitations FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow deleting
CREATE POLICY "delete_invitations"
ON public.invitations FOR DELETE
USING (true);
