import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global hook that handles app resume after backgrounding.
 * Refreshes auth tokens, reconnects realtime, detects idle periods, and keeps data fresh.
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastResumeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const isRecoveringRef = useRef<boolean>(false);

  const performRecovery = async (reason: string) => {
    if (isRecoveringRef.current) return;

    const now = Date.now();
    if (now - lastResumeRef.current < 1000) {
      return;
    }
    lastResumeRef.current = now;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      isRecoveringRef.current = true;
      try {
        console.log(`🔄 App resume triggered (${reason})`);

        // 1. Direct REST health ping to wake the network stack
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          await fetch(`${supabase.supabaseUrl}/rest/v1/?`, {
            method: 'HEAD',
            headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data?.session?.access_token || ''}` },
            signal: controller.signal,
          }).catch(() => null);
          clearTimeout(timeoutId);
        } catch (err) {
          console.warn('Health ping failed:', err);
        }

        // 2. Refresh auth session if JWT is near expiry
        try {
          const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000))
          ]) as any;

          if (data?.session) {
            const expiresAt = data.session.expires_at || 0;
            const nowSeconds = Math.floor(Date.now() / 1000);
            const secondsUntilExpiry = expiresAt - nowSeconds;

            if (secondsUntilExpiry < 300) {
              console.log('🔑 Refreshing auth session...');
              await Promise.race([
                supabase.auth.refreshSession(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 5000))
              ]);
            }
          }
        } catch (err) {
          console.warn('Auth refresh failed:', err);
        }

        // 3. Reconnect realtime
        try {
          await Promise.race([
            supabase.realtime.reconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Realtime timeout')), 5000))
          ]);
          console.log('🔌 Realtime reconnected');
        } catch (err) {
          console.warn('Realtime reconnect failed:', err);
        }

        // 4. Dispatch global resume event for realtime channels to self-heal
        window.dispatchEvent(new Event('hotelmanager:app-resume'));

        // 5. Invalidate and refetch active queries
        console.log('📡 Refetching active queries...');
        queryClient.setQueryData([], (prev: any) => prev, { updatedAt: Date.now() });
        await queryClient.refetchQueries({ type: 'active' });

      } catch (error) {
        console.error('Error during app resume:', error);

        // Last resort: try a page refresh after repeated failures
        if ((lastResumeRef.current || 0) % 3 === 0) {
          console.warn('Multiple recovery failures, attempting guided refresh...');
          setTimeout(() => {
            if (document.visibilityState === 'visible' && !document.hidden) {
              window.location.reload();
            }
          }, 2000);
        }
      } finally {
        isRecoveringRef.current = false;
      }
    }, 500);
  };

  const handleIdleTimeout = () => {
    performRecovery('idle timeout');
  };

  const resetIdleTimeout = () => {
    lastActivityRef.current = Date.now();
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    // Trigger recovery every 60 seconds of inactivity
    idleTimeoutRef.current = setTimeout(handleIdleTimeout, 60_000);
  };

  const startHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    // Heartbeat every 4 minutes when tab is visible
    heartbeatRef.current = setInterval(() => {
      if (!document.hidden) {
        performRecovery('heartbeat');
      }
    }, 4 * 60 * 1000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = undefined;
    }
  };

  useEffect(() => {
    // Resume on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        performRecovery('visibility change');
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    // Resume on page show (browser back-forward cache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        performRecovery('page show (bfcache)');
        startHeartbeat();
      }
    };

    // Resume on online
    const handleOnline = () => {
      performRecovery('online');
    };

    // Resume on window focus
    const handleFocus = () => {
      performRecovery('window focus');
      startHeartbeat();
    };

    // Resume on window blur
    const handleBlur = () => {
      stopHeartbeat();
    };

    // Track user activity and reset idle timeout
    const handleUserActivity = () => {
      resetIdleTimeout();
    };

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // User activity listeners
    document.addEventListener('pointerdown', handleUserActivity, { passive: true });
    document.addEventListener('touchstart', handleUserActivity, { passive: true });
    document.addEventListener('keydown', handleUserActivity, { passive: true });

    // Start idle timeout and heartbeat on mount
    resetIdleTimeout();
    startHeartbeat();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      stopHeartbeat();

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('pointerdown', handleUserActivity);
      document.removeEventListener('touchstart', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
    };
  }, [queryClient]);
}
