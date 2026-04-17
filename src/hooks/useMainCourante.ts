import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const toLocalDateKey = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useEnsureMainCourante = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ hotelId, date }: { hotelId: string; date: string }) => {
      // Fetch active stays
      const { data: activeStays } = await supabase
        .from('stays')
        .select('*, guests(last_name, first_name), rooms(room_number)')
        .eq('hotel_id', hotelId)
        .eq('status', 'active')
        .lte('check_in_date', `${date}T23:59:59`);

      if (!activeStays?.length) return;

      const prevDate = new Date(`${date}T00:00:00`);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = toLocalDateKey(prevDate);

      for (const stay of activeStays) {
        const guest = (stay as any).guests;
        const room = (stay as any).rooms;
        if (!guest) continue;

        // Check if already exists
        const { data: existing } = await supabase
          .from('main_courante')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('journee', date)
          .eq('guest_id', stay.guest_id)
          .maybeSingle();

        if (existing) continue;

        // Get previous day's a_reporter
        const { data: prevEntry } = await supabase
          .from('main_courante')
          .select('a_reporter')
          .eq('hotel_id', hotelId)
          .eq('guest_id', stay.guest_id)
          .eq('journee', prevDateStr)
          .maybeSingle();

        const isCheckInDay = toLocalDateKey(stay.check_in_date) === date;
        const negotiatedTotal = Number(stay.arrangement_price || 0);
        const configuredUnits = stay.stay_type === 'sieste'
          ? 1
          : Math.max(1, Number(stay.number_of_nights || 1));
        const effectiveUnitPrice = negotiatedTotal > 0
          ? negotiatedTotal / configuredUnits
          : Number(stay.price_per_night || 0);
        const hebergement = isCheckInDay ? effectiveUnitPrice : 0;
        const reportVeille = prevEntry?.a_reporter || 0;

        await supabase.from('main_courante').insert({
          hotel_id: hotelId,
          journee: date,
          room_number: room?.room_number || '',
          room_id: stay.room_id,
          guest_id: stay.guest_id,
          nom_client: `${guest.last_name} ${guest.first_name}`,
          nombre_personnes: (stay.number_of_adults || 1) + (stay.number_of_children || 0),
          hebergement,
          report_veille: reportVeille,
        } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['main-courante'] }),
  });
};
