import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useRealtimeTable = (tableName: string, queryKey: string[]) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionIdRef = useRef<string>(`realtime-${tableName}-${Math.random()}`);
  const queryKeyRef = useRef(queryKey);

  queryKeyRef.current = queryKey;

  const setupChannel = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = subscriptionIdRef.current;

    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: true } } })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
        }
      )
      .on('system', { event: 'join' }, () => {
        console.log(`✅ Realtime channel "${tableName}" connected`);
      })
      .on('system', { event: 'leave' }, () => {
        console.log(`❌ Realtime channel "${tableName}" disconnected`);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`📡 Subscribed to ${tableName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`Channel error for ${tableName}:`, err);
          setTimeout(() => setupChannel(), 2000);
        } else if (status === 'TIMED_OUT') {
          console.warn(`Channel timeout for ${tableName}`);
          setTimeout(() => setupChannel(), 2000);
        } else if (status === 'CLOSED') {
          console.warn(`Channel closed for ${tableName}`);
          setTimeout(() => setupChannel(), 2000);
        }
      });

    channelRef.current = channel;
  };

  useEffect(() => {
    setupChannel();

    // Recreate channel on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log(`🔄 Recreating channel for ${tableName} after visibility change`);
        setupChannel();
      }
    };

    // Recreate channel on global app resume
    const handleAppResume = () => {
      console.log(`🔄 Recreating channel for ${tableName} on app resume`);
      setupChannel();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('hotelmanager:app-resume', handleAppResume);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('hotelmanager:app-resume', handleAppResume);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tableName, queryClient]);
};
