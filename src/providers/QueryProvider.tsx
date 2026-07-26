/**
 * TanStack Query provider with AsyncStorage persistence for vault cards.
 *
 * Cards (ciphertext + metadata) hydrate from disk on cold start so Vault and
 * Card Detail render offline. Network refetch keeps the cache fresh in the
 * background and never gates the initial paint when cached data exists.
 */

import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';

const PERSIST_KEY = 'keykards.rq.v1';
/** Keep card rows on disk across cold starts (ms). */
const CARD_GC_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: CARD_GC_MS,
        retry: 1,
        refetchOnWindowFocus: false,
        // Serve cached data immediately; refetch when online in the background.
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  });
}

function shouldPersistQuery(query: { queryKey: readonly unknown[] }): boolean {
  const key = query.queryKey;
  // Persist vault card list + detail (ciphertext local; AES key in SecureStore).
  return Array.isArray(key) && key[0] === 'cards';
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  const [persister] = useState<Persister>(() =>
    createAsyncStoragePersister({
      storage: AsyncStorage,
      key: PERSIST_KEY,
      throttleTime: 1000,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: CARD_GC_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && shouldPersistQuery(query),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
