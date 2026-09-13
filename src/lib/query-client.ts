/**
 * The TanStack Query client and its disk persistence.
 *
 * The web app layers four separate caches — SWR, a 24-hour localStorage blob, an
 * in-memory LRU, and a 15-second fingerprint poller. All four exist to give a
 * browser the behaviour TanStack Query provides natively, so none of them are
 * ported here.
 *
 * See `query-keys.ts` for the key taxonomy and the invalidation rules that go
 * with it.
 */

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, keepPreviousData } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { isPersistedKey } from '@/lib/query-keys';

/** Written by the persister; also the key to remove when signing out. */
const PERSIST_KEY = 'antunello.query-cache.v1';

const HOUR = 60 * 60 * 1000;

/**
 * Whether an error is the server's fault.
 *
 * Client errors (4xx) will not succeed on retry — a malformed query or a
 * permission denial just fails identically two more times and delays the error
 * reaching the screen.
 */
function isClientError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * Tells React Query when the app has come back to the foreground.
 *
 * React Native has no window-focus events, so `refetchOnWindowFocus` would do
 * nothing on its own — which is how this app came to document a foreground
 * refresh it did not have. App-state changes are the native equivalent, and
 * TanStack's focus manager is the seam for them: with this wired, returning to
 * the app refetches whatever has gone stale, exactly as the docs describe.
 */
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status) => {
    handleFocus(status === 'active');
  });

  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Short, because the fingerprint poll and pull-to-refresh are the
      // intended ways to pick up remote changes rather than passive staleness.
      staleTime: 30_000,
      // Kept for a day so a cold start renders the last session's data
      // instantly, matching how the web app feels with its localStorage layer.
      gcTime: 24 * HOUR,
      // Keeps the previous period on screen while a new one loads, so paging
      // through months swaps content in place instead of flashing a skeleton.
      placeholderData: keepPreviousData,
      retry: (count, error) => !isClientError(error) && count < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Meaningful only because of the focus-manager wiring below. Returning to
      // the app is otherwise invisible to React Query, and with no Realtime and
      // no polling it is the only passive way remote changes arrive.
      refetchOnWindowFocus: true,
      // Unlike the web app, which disabled this for iOS Safari tab-wake
      // reasons that do not exist natively.
      refetchOnReconnect: true,
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      // With `online` mode an offline write rejects immediately and visibly,
      // rather than hanging. Writes require a connection by design.
      networkMode: 'online',
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: Storage,
  key: PERSIST_KEY,
  throttleTime: 1500,
});

/**
 * Persistence options for `PersistQueryClientProvider`.
 *
 * Only transaction-shaped data is written to disk — see `isPersistedKey`. Search
 * results and title suggestions are keyed by arbitrary user input and would
 * accumulate without bound, and are cheap to refetch.
 */
export const persistOptions = {
  persister,
  maxAge: 24 * HOUR,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      query.state.status === 'success' && isPersistedKey(query.queryKey),
  },
};

/**
 * Discards every cached value, memory and disk.
 *
 * Must run on sign-out. The persisted blob holds transaction titles and amounts
 * in plain SQLite, so leaving it behind would let the next person to open the
 * app read the previous account's data.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await Storage.removeItem(PERSIST_KEY);
  } catch {
    // Nothing useful to do — the in-memory cache is already cleared, and the
    // blob is bounded by `maxAge`.
  }
}
