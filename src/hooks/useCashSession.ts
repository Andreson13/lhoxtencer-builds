import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';

export const useCashSession = () => {
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();

  const { data: currentSession } = useQuery({
    queryKey: ['cash-session-auto', hotel?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('hotel_id', hotel!.id)
        .eq('status', 'open')
        .gte('opened_at', `${today}T00:00:00`)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!hotel?.id,
  });

  const ensureSessionMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) return null;
      const today = new Date().toISOString().split('T')[0];

      // Check if open session exists for today
      const { data: existing } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('hotel_id', hotel.id)
        .eq('status', 'open')
        .gte('opened_at', `${today}T00:00:00`)
        .limit(1)
        .maybeSingle();

      if (existing) return existing;

      // Close any old open sessions
      const { data: oldSessions } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('hotel_id', hotel.id)
        .eq('status', 'open')
        .lt('opened_at', `${today}T00:00:00`);

      for (const old of oldSessions || []) {
        await supabase.from('cash_sessions').update({
          status: 'closed',
          closed_at: new Date(old.opened_at!).toISOString().split('T')[0] + 'T23:59:59',
          closed_by: profile.id,
          closing_balance: old.expected_balance || old.opening_balance,
          difference: 0,
        }).eq('id', old.id);
      }

      // Get yesterday's closing balance
      const { data: lastClosed } = await supabase
        .from('cash_sessions')
        .select('closing_balance')
        .eq('hotel_id', hotel.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const openingBalance = lastClosed?.closing_balance || 0;

      const { data: newSession } = await supabase.from('cash_sessions').insert({
        hotel_id: hotel.id,
        opened_by: profile.id,
        opening_balance: openingBalance,
      } as any).select().single();

      return newSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-session-auto'] }),
  });

  useEffect(() => {
    if (hotel?.id && profile?.id && !currentSession) {
      ensureSessionMutation.mutate();
    }
  }, [hotel?.id, profile?.id, currentSession]);

  return { currentSession };
};
