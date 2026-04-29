-- Add category column to inventory_items table

ALTER TABLE public.inventory_items
ADD COLUMN category text DEFAULT 'other';

-- Create index for category queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
