import { useQuery } from '@tanstack/react-query';
import { synchronizeActiveStayAccruals } from '@/services/transactionService';

const TEN_MINUTES = 10 * 60 * 1000;

export const useStayAccrualSync = (hotelId?: string) => {
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
    enabled: !!hotelId,
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchIntervalInBackground: false,
    retry: 0,
  });
};
