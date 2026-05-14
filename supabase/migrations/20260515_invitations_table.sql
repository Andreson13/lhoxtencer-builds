-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  is_hotel_owner BOOLEAN DEFAULT FALSE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations for their hotels
CREATE POLICY "read_own_hotel_invitations"
ON public.invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.hotel_id = invitations.hotel_id OR profiles.is_super_admin)
  )
);

-- Policy: Admins/Managers can create invitations
CREATE POLICY "create_hotel_invitations"
ON public.invitations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    JOIN public.hotel_memberships ON hotel_memberships.user_id = profiles.id
    WHERE profiles.id = auth.uid()
    AND hotel_memberships.hotel_id = invitations.hotel_id
    AND hotel_memberships.role IN ('admin', 'manager')
  )
);

-- Policy: Admins/Managers can update invitation status
CREATE POLICY "update_hotel_invitations"
ON public.invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    JOIN public.hotel_memberships ON hotel_memberships.user_id = profiles.id
    WHERE profiles.id = auth.uid()
    AND hotel_memberships.hotel_id = invitations.hotel_id
    AND hotel_memberships.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    JOIN public.hotel_memberships ON hotel_memberships.user_id = profiles.id
    WHERE profiles.id = auth.uid()
    AND hotel_memberships.hotel_id = invitations.hotel_id
    AND hotel_memberships.role IN ('admin', 'manager')
  )
);

-- Policy: Users can view their own pending invitations
CREATE POLICY "user_view_own_invitations"
ON public.invitations FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
);

-- Policy: Users can accept/reject their own invitations
CREATE POLICY "user_accept_reject_invitations"
ON public.invitations FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_invitations_email_status ON public.invitations(email, status);
CREATE INDEX idx_invitations_hotel_status ON public.invitations(hotel_id, status);
CREATE INDEX idx_invitations_created_at ON public.invitations(created_at DESC);
