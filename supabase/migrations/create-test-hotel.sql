-- Create a test hotel if it doesn't exist
INSERT INTO public.hotels (name, slug, city, country, address, phone, email, description, status, created_at)
VALUES (
  'Test Hotel',
  'test-hotel',
  'Dakar',
  'Senegal',
  '123 Main Street, Dakar',
  '+221 77 123 4567',
  'info@testhotel.com',
  'A beautiful test hotel with modern amenities and exceptional service. Perfect for business travelers and vacationers.',
  'active',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Get the hotel ID
SELECT id, name, slug FROM public.hotels WHERE slug = 'test-hotel';
