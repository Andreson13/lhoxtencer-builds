import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { synchronizeActiveStayAccruals } from '@/services/transactionService';

const TEN_MINUTES = 10 * 60 * 1000;
const INITIAL_SYNC_DELAY = 8000;

export const useStayAccrualSync = (hotelId?: string) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!hotelId) return;

    const timer = window.setTimeout(() => {
      setReady(true);
    }, INITIAL_SYNC_DELAY);

    return () => window.clearTimeout(timer);
  }, [hotelId]);

  return useQuery({
    queryKey: ['stay-accrual-sync', hotelId],
    queryFn: async () => {
      if (!hotelId) return null;
      try {
        return await synchronizeActiveStayAccruals(hotelId);
      } catch (error) {
        console.warn('stay accrual sync failed', error);
        return null;
      }
    },
    enabled: !!hotelId && ready,
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 0,
  });
};
