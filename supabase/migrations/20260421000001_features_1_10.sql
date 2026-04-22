-- ============================================================
-- FEATURES 1-10 MIGRATION
-- Date: 2026-04-21
-- ============================================================

-- -------------------------------------------------------
-- FEATURE 1: Government tax & fixed charges
-- hotel_settings already exists as key/value table – no schema change needed
-- Only update invoice_items check constraint to allow 'tax'
-- -------------------------------------------------------
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_item_type_check;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_item_type_check
  CHECK (item_type IN ('room','sieste','restaurant','bar','extra','minibar','service','other','tax'));

-- -------------------------------------------------------
-- FEATURE 2: Customer tier system
-- -------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'regular'
    CHECK (tier IN ('regular','silver','gold','vip','blacklist')),
  ADD COLUMN IF NOT EXISTS tier_assigned_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS tier_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier_notes text,
  ADD COLUMN IF NOT EXISTS loyalty_points integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tier_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  tier text NOT NULL CHECK (tier IN ('silver','gold','vip')),
  benefit_type text NOT NULL CHECK (benefit_type IN ('discount_percentage','free_night_after_stays','priority_room','free_breakfast','complimentary_upgrade')),
  benefit_value numeric DEFAULT 0,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tier_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_tier_benefits" ON public.tier_benefits;
DROP POLICY IF EXISTS "manage_tier_benefits" ON public.tier_benefits;

CREATE POLICY "read_tier_benefits" ON public.tier_benefits
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());

CREATE POLICY "manage_tier_benefits" ON public.tier_benefits
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

-- -------------------------------------------------------
-- FEATURE 3: CNI scanning – add id_document_url to guests
-- -------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS id_document_url text;

-- -------------------------------------------------------
-- FEATURE 5: Loyalty packages
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  description text,
  required_tier text CHECK (required_tier IN ('regular','silver','gold','vip')),
  price numeric NOT NULL DEFAULT 0,
  validity_days integer DEFAULT 30,
  included_nights integer DEFAULT 0,
  included_siestes integer DEFAULT 0,
  breakfast_included boolean DEFAULT false,
  discount_percentage numeric DEFAULT 0,
  features text[] DEFAULT '{}',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  guest_id uuid REFERENCES public.guests(id) NOT NULL,
  package_id uuid REFERENCES public.loyalty_packages(id) NOT NULL,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  nights_used integer DEFAULT 0,
  siestes_used integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','expired','exhausted')),
  purchased_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_loyalty_packages" ON public.loyalty_packages;
DROP POLICY IF EXISTS "manage_loyalty_packages" ON public.loyalty_packages;
DROP POLICY IF EXISTS "read_guest_packages" ON public.guest_packages;
DROP POLICY IF EXISTS "manage_guest_packages" ON public.guest_packages;

CREATE POLICY "read_loyalty_packages" ON public.loyalty_packages
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());

CREATE POLICY "manage_loyalty_packages" ON public.loyalty_packages
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager'));

CREATE POLICY "read_guest_packages" ON public.guest_packages
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());

CREATE POLICY "manage_guest_packages" ON public.guest_packages
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin','manager','receptionist'));

-- -------------------------------------------------------
-- FEATURE 6: Advanced permissions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  role text NOT NULL,
  permission text NOT NULL,
  granted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hotel_id, role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "manage_role_permissions" ON public.role_permissions;

CREATE POLICY "read_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id() OR public.is_super_admin());

CREATE POLICY "manage_role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (hotel_id = public.get_user_hotel_id() AND public.get_user_role() IN ('admin'));

-- -------------------------------------------------------
-- FEATURE 7: Restaurant item enrichment
-- -------------------------------------------------------
ALTER TABLE public.restaurant_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS ingredients text[],
  ADD COLUMN IF NOT EXISTS allergens text[],
  ADD COLUMN IF NOT EXISTS preparation_time_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS is_available_today boolean DEFAULT true;
