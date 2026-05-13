import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Subscribe to Postgres changes on multiple tables via Supabase Realtime.
 * Automatically refetches data when any of the tables change.
 * Includes visibility/focus handlers for background app refresh.
 */
export function useRealtimeTables(
  tables: string[],
  onAnyChange: () => void | Promise<void>,
  shopId?: string
) {
  const callbackRef = useRef(onAnyChange);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isRefreshingRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onAnyChange;
  }, [onAnyChange]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channels = tables.map((table) => {
      const channelName = `realtime-${table}-${shopId || 'all'}`;

      return supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(shopId ? { filter: `shop_id=eq.${shopId}` } : {}),
          },
          () => {
            scheduleRefresh('postgres_changes');
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), shopId]);

  // Handle visibility/focus changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleRefresh('visibilitychange');
      }
    };

    const handleFocus = () => {
      scheduleRefresh('focus');
    };

    const scheduleRefresh = (source: string) => {
      // Clear any pending refresh
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Skip if already refreshing
      if (isRefreshingRef.current) {
        console.log(`⏭️  Refresh already in progress (${source}), skipping`);
        return;
      }

      // Debounce: wait 300ms before refreshing to batch multiple triggers
      timeoutRef.current = window.setTimeout(() => {
        if (!isRefreshingRef.current) {
          performRefresh(source);
        }
      }, 300);
    };

    const performRefresh = async (source: string) => {
      isRefreshingRef.current = true;
      try {
        console.log(`🔄 Refreshing data (${source})`);
        await callbackRef.current();
      } catch (error) {
        // Silently ignore abort/lock errors
        if (error instanceof Error) {
          if (error.message.includes('AbortError') || error.message.includes('Lock broken')) {
            console.debug('ℹ️  Request aborted (overlapping refresh)');
            return;
          }
        }
        console.error('Error refreshing data:', error);
      } finally {
        isRefreshingRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
}
