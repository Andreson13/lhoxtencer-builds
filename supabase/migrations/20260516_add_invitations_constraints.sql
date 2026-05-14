-- Add unique constraint to invitations table for upsert
ALTER TABLE public.invitations
ADD CONSTRAINT unique_hotel_email_status UNIQUE (hotel_id, email, status);
