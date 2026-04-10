
-- Hotels (SaaS tenants)
CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  address text,
  city text,
  country text DEFAULT 'Cameroun',
  phone text,
  email text,
  whatsapp text,
  logo_url text,
  currency text DEFAULT 'FCFA',
  timezone text DEFAULT 'Africa/Douala',
  subscription_plan text DEFAULT 'starter' CHECK (subscription_plan IN ('starter','professional','enterprise')),
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active','trial','suspended')),
  sieste_default_duration_hours integer DEFAULT 3,
  sieste_overtime_rate_per_hour numeric DEFAULT 2000,
  created_at timestamptz DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid REFERENCES public.hotels(id),
  full_name text,
  email text,
  phone text,
  role text DEFAULT 'receptionist' CHECK (role IN ('admin','manager','receptionist','accountant','restaurant','kitchen','housekeeping')),
  is_hotel_owner boolean DEFAULT false,
  is_super_admin boolean DEFAULT false,
  disabled boolean DEFAULT false,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Room types
CREATE TABLE public.room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  description text,
  base_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Rooms
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  room_number text NOT NULL,
  room_type_id uuid REFERENCES public.room_types(id),
  floor integer DEFAULT 1,
  capacity integer DEFAULT 2,
  price_per_night numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'available' CHECK (status IN ('available','occupied','housekeeping','maintenance','out_of_order')),
  features text[] DEFAULT '{}',
  portal_visible boolean DEFAULT true,
  is_minibar boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Guests
CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  last_name text NOT NULL,
  first_name text NOT NULL,
  maiden_name text,
  date_of_birth date,
  place_of_birth text,
  gender text CHECK (gender IN ('M','F')),
  nationality text DEFAULT 'Camerounaise',
  country_of_residence text DEFAULT 'Cameroun',
  usual_address text,
  profession text,
  phone text,
  email text,
  coming_from text,
  going_to text,
  means_of_transport text,
  number_of_adults integer DEFAULT 1,
  number_of_children integer DEFAULT 0,
  id_type text,
  id_number text,
  id_issued_on date,
  id_issued_at text,
  room_id uuid REFERENCES public.rooms(id),
  check_in_date timestamptz,
  check_out_date timestamptz,
  number_of_nights integer,
  arrangement text,
  price_per_night numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  status text DEFAULT 'present' CHECK (status IN ('present','checked_out','reserved','no_show')),
  receptionist_id uuid REFERENCES public.profiles(id),
  receptionist_name text,
  customer_signature_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Reservations
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  reservation_number text NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  room_id uuid REFERENCES public.rooms(id),
  room_type_id uuid REFERENCES public.room_types(id),
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  number_of_nights integer,
  number_of_adults integer DEFAULT 1,
  number_of_children integer DEFAULT 0,
  payment_method_cash boolean DEFAULT false,
  payment_method_om boolean DEFAULT false,
  payment_method_momo boolean DEFAULT false,
  status text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show')),
  special_requests text,
  total_price numeric DEFAULT 0,
  deposit_paid numeric DEFAULT 0,
  source text DEFAULT 'direct' CHECK (source IN ('direct','portal','phone','walkin')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  guest_id uuid REFERENCES public.guests(id),
  reservation_id uuid REFERENCES public.reservations(id),
  invoice_number text NOT NULL,
  parent_invoice_id uuid REFERENCES public.invoices(id),
  is_split boolean DEFAULT false,
  status text DEFAULT 'open' CHECK (status IN ('open','paid','partial','split','cancelled')),
  subtotal numeric DEFAULT 0,
  tax_percentage numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) NOT NULL,
  description text NOT NULL,
  item_type text DEFAULT 'room' CHECK (item_type IN ('room','restaurant','extra','minibar','service','other')),
  quantity numeric DEFAULT 1,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) NOT NULL,
  amount numeric NOT NULL,
  payment_method text CHECK (payment_method IN ('cash','mtn_momo','orange_money','bank_transfer','other')),
  reference_number text,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Siestes
CREATE TABLE public.siestes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  order_number integer,
  room_id uuid REFERENCES public.rooms(id),
  full_name text NOT NULL,
  phone text,
  date_of_birth date,
  nationality text,
  profession text,
  id_number text,
  id_issued_on date,
  arrival_date date NOT NULL DEFAULT current_date,
  arrival_time time NOT NULL,
  departure_date date,
  departure_time time,
  duration_hours integer,
  overtime_hours numeric DEFAULT 0,
  overtime_charged boolean DEFAULT false,
  amount_paid numeric DEFAULT 0,
  payment_method text,
  invoice_id uuid REFERENCES public.invoices(id),
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Main courante
CREATE TABLE public.main_courante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  journee date NOT NULL DEFAULT current_date,
  room_number text,
  room_id uuid REFERENCES public.rooms(id),
  guest_id uuid REFERENCES public.guests(id),
  nombre_personnes integer DEFAULT 1,
  nom_client text NOT NULL,
  hebergement numeric DEFAULT 0,
  bar numeric DEFAULT 0,
  restaurant numeric DEFAULT 0,
  divers numeric DEFAULT 0,
  ca_total_jour numeric GENERATED ALWAYS AS (hebergement + bar + restaurant + divers) STORED,
  deduction numeric DEFAULT 0,
  report_veille numeric DEFAULT 0,
  encaissement numeric DEFAULT 0,
  a_reporter numeric GENERATED ALWAYS AS (hebergement + bar + restaurant + divers + report_veille - deduction - encaissement) STORED,
  observation text,
  is_manual boolean DEFAULT false,
  day_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hotel_id, journee, room_id)
);

-- Restaurant categories
CREATE TABLE public.restaurant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Restaurant items
CREATE TABLE public.restaurant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  category_id uuid REFERENCES public.restaurant_categories(id),
  inventory_item_id uuid,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Restaurant orders
CREATE TABLE public.restaurant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  order_number text NOT NULL,
  room_id uuid REFERENCES public.rooms(id),
  guest_id uuid REFERENCES public.guests(id),
  invoice_id uuid REFERENCES public.invoices(id),
  is_walkin boolean DEFAULT false,
  walkin_name text,
  walkin_table text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_preparation','ready','delivered','billed','cancelled')),
  total_amount numeric DEFAULT 0,
  billed_to_room boolean DEFAULT false,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Restaurant order items
CREATE TABLE public.restaurant_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  order_id uuid REFERENCES public.restaurant_orders(id) NOT NULL,
  item_id uuid REFERENCES public.restaurant_items(id) NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL
);

-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  reference_number text,
  receipt_url text,
  expense_date date NOT NULL DEFAULT current_date,
  approval_status text DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval','approved','rejected')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Cash sessions
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  opened_by uuid REFERENCES public.profiles(id),
  closed_by uuid REFERENCES public.profiles(id),
  opening_balance numeric NOT NULL DEFAULT 0,
  closing_balance numeric,
  expected_balance numeric DEFAULT 0,
  difference numeric,
  status text DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- Cash movements
CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  session_id uuid REFERENCES public.cash_sessions(id),
  type text NOT NULL CHECK (type IN ('in','out')),
  source text NOT NULL,
  description text,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  reference_id uuid,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Inventory categories
CREATE TABLE public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Inventory items
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  category_id uuid REFERENCES public.inventory_categories(id),
  name text NOT NULL,
  unit text DEFAULT 'unité',
  buying_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  current_stock integer NOT NULL DEFAULT 0,
  minimum_stock integer DEFAULT 5,
  is_minibar boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Stock entries
CREATE TABLE public.stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  item_id uuid REFERENCES public.inventory_items(id) NOT NULL,
  quantity integer NOT NULL,
  buying_price numeric NOT NULL,
  supplier text,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Stock movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  item_id uuid REFERENCES public.inventory_items(id) NOT NULL,
  movement_type text CHECK (movement_type IN ('in','out')),
  quantity integer NOT NULL,
  source text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Housekeeping tasks
CREATE TABLE public.housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  room_id uuid REFERENCES public.rooms(id) NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','inspection','clean')),
  checklist jsonb DEFAULT '["Changer la literie","Nettoyer la salle de bain","Réapprovisionner les serviettes","Aspirer le sol","Réapprovisionner le minibar","Vérifier les équipements"]',
  checklist_done jsonb DEFAULT '[]',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  related_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  user_id uuid REFERENCES public.profiles(id),
  user_name text,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Hotel settings
CREATE TABLE public.hotel_settings (
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  key text NOT NULL,
  value text,
  PRIMARY KEY (hotel_id, key)
);

-- Hotel photos
CREATE TABLE public.hotel_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Hotel services
CREATE TABLE public.hotel_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  created_at timestamptz DEFAULT now()
);

-- Service requests
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  room_id uuid REFERENCES public.rooms(id),
  room_number text,
  request_type text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_at timestamptz DEFAULT now()
);

-- Guest feedback
CREATE TABLE public.guest_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES public.hotels(id) NOT NULL,
  room_id uuid REFERENCES public.rooms(id),
  room_number text,
  guest_id uuid REFERENCES public.guests(id),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
