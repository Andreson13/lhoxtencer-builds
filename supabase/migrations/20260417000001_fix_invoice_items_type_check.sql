-- Fix invoice_items item_type constraint to include 'sieste' and 'bar'
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_item_type_check;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_item_type_check
  CHECK (item_type IN ('room','sieste','restaurant','bar','extra','minibar','service','other'));
