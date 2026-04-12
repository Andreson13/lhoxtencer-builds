import { supabase } from '@/integrations/supabase/client';

export const updateMainCourante = async (
  hotelId: string,
  date: string,
  guestId: string | null,
  roomNumber: string,
  guestName: string,
  field: 'hebergement' | 'bar' | 'restaurant' | 'divers' | 'encaissement',
  amount: number,
) => {
  // Find existing row for this guest/date
  let query = supabase
    .from('main_courante')
    .select('id, hebergement, bar, restaurant, divers, encaissement')
    .eq('hotel_id', hotelId)
    .eq('journee', date)
    .eq('room_number', roomNumber);
  
  if (guestId) query = query.eq('guest_id', guestId);
  
  const { data: existing } = await query.limit(1).maybeSingle();

  if (existing) {
    const current = (existing as any)[field] || 0;
    await supabase.from('main_courante').update({
      [field]: current + amount,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabase.from('main_courante').insert({
      hotel_id: hotelId,
      journee: date,
      guest_id: guestId,
      room_number: roomNumber,
      nom_client: guestName,
      [field]: amount,
    } as any);
  }
};
