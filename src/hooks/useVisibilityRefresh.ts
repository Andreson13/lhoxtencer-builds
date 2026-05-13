import { useEffect, useRef } from 'react';

/**
 * Hook to refresh data when the app comes back into focus
 * This handles the case where the app is backgrounded and returns stale
 *
 * Includes debouncing and concurrent request prevention to avoid lock conflicts
 */
export function useVisibilityRefresh(refreshFn: () => Promise<void> | void) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // When the document becomes visible again, refresh the data
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
        console.log(`⏭️  Refresh already in progress, skipping ${source} trigger`);
        return;
      }

      // Debounce: wait 500ms before refreshing to batch multiple triggers
      timeoutRef.current = setTimeout(() => {
        if (!isRefreshingRef.current) {
          performRefresh(source);
        }
      }, 500);
    };

    const performRefresh = async (source: string) => {
      isRefreshingRef.current = true;
      try {
        console.log(`🔄 Refreshing data (triggered by ${source})`);
        await refreshFn();
      } catch (error) {
        // Silently ignore abort errors (expected when requests overlap)
        if (error instanceof Error && error.message.includes('AbortError')) {
          console.debug('ℹ️  Request aborted (overlapping refresh)');
        } else {
          console.error('Error during refresh:', error);
        }
      } finally {
        isRefreshingRef.current = false;
      }
    };

    // Listen for visibility change (app background/foreground on mobile)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for window focus (desktop app tab switching)
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshFn]);
}
