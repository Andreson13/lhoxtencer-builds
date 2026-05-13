import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Simple hook to refetch all React Query data when app regains focus
 * No debouncing, no Realtime, just plain React Query invalidation
 */
export function useQueryRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibilityChange = () => {
      // When document becomes visible again, invalidate all queries
      if (document.visibilityState === 'visible') {
        console.log('📱 App came back into focus - refetching data');
        queryClient.invalidateQueries();
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window focus - refetching data');
      queryClient.invalidateQueries();
    };

    // Listen for visibility change (app background/foreground on mobile)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for window focus (tab switching on desktop)
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient]);
}
