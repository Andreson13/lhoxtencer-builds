import { QueryClient } from '@tanstack/react-query';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

const QUERY_CACHE_KEY = 'hotel-harmony-react-query-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
  },
});

export const queryPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set(QUERY_CACHE_KEY, client);
  },
  restoreClient: async () => {
    return (await get<PersistedClient>(QUERY_CACHE_KEY)) ?? undefined;
  },
  removeClient: async () => {
    await del(QUERY_CACHE_KEY);
  },
};

export const queryPersistMaxAge = 1000 * 60 * 60 * 24 * 7;