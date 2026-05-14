-- Drop existing foreign key constraints from invoices
ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_guest_id_fkey;

ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_reservation_id_fkey;

-- Drop from stays table
ALTER TABLE public.stays
  DROP CONSTRAINT stays_guest_id_fkey;

ALTER TABLE public.stays
  DROP CONSTRAINT stays_reservation_id_fkey;

-- Drop from main_courante table
ALTER TABLE public.main_courante
  DROP CONSTRAINT main_courante_guest_id_fkey;

-- Recreate invoices constraints with ON DELETE CASCADE
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_reservation_id_fkey
  FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;

-- Recreate stays constraints with ON DELETE CASCADE
ALTER TABLE public.stays
  ADD CONSTRAINT stays_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.stays
  ADD CONSTRAINT stays_reservation_id_fkey
  FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;

-- Recreate main_courante constraint with ON DELETE CASCADE
ALTER TABLE public.main_courante
  ADD CONSTRAINT main_courante_guest_id_fkey
  FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;
