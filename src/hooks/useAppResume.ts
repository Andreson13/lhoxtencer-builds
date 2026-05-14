import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global hook that handles app resume after backgrounding.
 * Refreshes auth tokens, reconnects realtime, and invalidates stale data.
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastResumeRef = useRef<number>(0);

  useEffect(() => {
    const handleResume = async () => {
      // Debounce rapid visibility/focus events (1s window)
      const now = Date.now();
      if (now - lastResumeRef.current < 1000) {
        return;
      }
      lastResumeRef.current = now;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        try {
          // 1. Refresh auth session if JWT is near expiry
          const { data, error } = await supabase.auth.getSession();
          if (data?.session) {
            const expiresAt = data.session.expires_at || 0;
            const nowSeconds = Math.floor(Date.now() / 1000);
            const secondsUntilExpiry = expiresAt - nowSeconds;

            // Refresh if within 60 seconds of expiry
            if (secondsUntilExpiry < 60) {
              console.log('🔄 JWT near expiry, refreshing...');
              await supabase.auth.refreshSession();
            }
          }

          // 2. Reconnect realtime
          console.log('🔌 Reconnecting realtime...');
          await supabase.realtime.reconnect();

          // 3. Invalidate all queries to refetch fresh data
          console.log('📡 Invalidating queries...');
          await queryClient.invalidateQueries();
        } catch (error) {
          console.error('Error resuming app:', error);
        }
      }, 1000);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleResume();
      }
    };

    const handleOnline = () => {
      handleResume();
    };

    const handleFocus = () => {
      handleResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient]);
}
