/**
 * The bank rows waiting to be reviewed.
 *
 * The web app polls this every 60 seconds. There is no equivalent here: the sync
 * runs on Vercel whether or not the app is open, so the only thing a poll would
 * change is how quickly a row appears while the user is already looking at the
 * screen. A refetch on foreground and pull-to-refresh cover that, and neither
 * costs a request every minute of every session.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchPendingTransactions } from '@/features/pending/queries';
import type { PendingTransaction } from '@/features/pending/types';
import { useAuth } from '@/features/auth/auth-provider';
import { qk } from '@/lib/query-keys';

type PendingTransactions = {
  pending: PendingTransaction[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refresh: () => Promise<void>;
};

/**
 * Loads the pending queue.
 *
 * @returns The pending rows and the state of the request.
 */
export function usePendingTransactions(): PendingTransactions {
  const { session } = useAuth();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: qk.pending(),
    // Disabled without a session: the fetcher needs an id to filter on, and the
    // sign-out path clears the cache around it.
    enabled: Boolean(userId),
    queryFn: () => fetchPendingTransactions(userId as string),
  });

  return {
    pending: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: async () => {
      await query.refetch();
    },
  };
}
