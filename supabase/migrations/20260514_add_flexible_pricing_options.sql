-- Add flexible pricing columns to room_categories
ALTER TABLE public.room_categories
ADD COLUMN IF NOT EXISTS enable_day_pricing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_sieste_pricing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sieste_pricing_type text DEFAULT 'fixed' CHECK (sieste_pricing_type IN ('fixed', 'hourly')),
ADD COLUMN IF NOT EXISTS price_per_hour_sieste numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS enable_nuitee_pricing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS price_nuitee numeric DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_room_categories_pricing ON public.room_categories(hotel_id, enable_day_pricing, enable_sieste_pricing, enable_nuitee_pricing);
