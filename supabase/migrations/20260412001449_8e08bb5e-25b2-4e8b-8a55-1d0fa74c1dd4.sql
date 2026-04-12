
-- Add arrangement_price to stays
ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS arrangement_price numeric;

-- Add guest_id to siestes
ALTER TABLE public.siestes ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.guests(id);

-- Add stay_id to restaurant_orders
ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS stay_id uuid REFERENCES public.stays(id);

-- Add breakfast/bundle fields to room_categories
ALTER TABLE public.room_categories ADD COLUMN IF NOT EXISTS breakfast_included boolean DEFAULT false;
ALTER TABLE public.room_categories ADD COLUMN IF NOT EXISTS breakfast_price numeric DEFAULT 0;
ALTER TABLE public.room_categories ADD COLUMN IF NOT EXISTS extra_options jsonb DEFAULT '[]'::jsonb;
