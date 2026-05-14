# Category Images Setup Guide

## What has been implemented:

### 1. Hotel Manager (hotel-harmony-781ad4c5)
- ✅ Image upload UI in RoomCategoriesPage
- ✅ Multiple image support per category
- ✅ Image preview in category cards
- ✅ Drag & drop file input
- ✅ Remove individual images

### 2. Booking Portal (golden-gate-bookings)
- ✅ Hook to fetch categories with images
- ✅ Display category images in room cards
- ✅ Fallback to placeholder if no images

## What needs to be set up in Supabase:

### 1. Add images column to room_categories table

Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE room_categories 
ADD COLUMN images text[] DEFAULT ARRAY[]::text[];
```

### 2. Create category-images storage bucket

In Supabase Dashboard:
1. Go to Storage
2. Create new bucket named: `category-images`
3. Set policies to allow public read access:

```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'category-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'category-images' AND auth.role() = 'authenticated');
```

## How to use:

1. **Upload images in hotel manager:**
   - Go to Room Categories page
   - Click "Add Category" or edit existing category
   - Scroll to "🖼️ Images de la catégorie" section
   - Click the upload area to select images (supports multiple)
   - Images preview appears below
   - Hover and click X to remove images
   - Save category

2. **View images in booking portal:**
   - Go to golden-gate-bookings
   - Category images will display on room cards
   - Users can browse through multiple images per category

## Image specifications:

- **Formats:** JPEG, PNG, WebP, GIF
- **Recommended size:** 1280x960px or 4:3 aspect ratio
- **File size:** Recommended < 2MB per image
- **Number of images:** Unlimited per category

## Testing:

1. Upload 2-3 images to a test category
2. Check that they appear in the category card in hotel manager
3. Verify they appear on the booking portal (golden-gate-bookings)
4. Test image navigation with arrows/swipe on room cards
