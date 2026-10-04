/**
 * Polls for changes made on another device.
 *
 * Mirrors the web app's `BackgroundSyncProvider`: a cheap count-and-timestamp
 * query every 15 seconds while foregrounded, and on a change the visible data is
 * refetched in place with a banner as the cue. TanStack Query pauses an interval
 * while the app is backgrounded (its focus manager follows `AppState`), so
 * nothing polls from the background.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import {
  POLL_INTERVAL_MS,
  describeRemoteChange,
  detectRemoteChange,
  getLocalWriteCount,
  type RemoteVersion,
} from '@/features/sync/remote-changes';
import { invalidateAfterWrite } from '@/features/transactions/mutations';
import { supabase } from '@/lib/supabase';

async function fetchRemoteVersion(): Promise<RemoteVersion> {
  const { data, count, error } = await supabase
    .from('transactions')
    .select('id, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return { count: count ?? 0, lastUpdate: data?.[0]?.updated_at ?? '' };
}

/**
 * @returns The banner text while a remote change is being shown, and a way to
 *   dismiss it.
 */
export function useRemoteChanges() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const baseline = useRef<RemoteVersion | null>(null);
  const writesAtBaseline = useRef(getLocalWriteCount());

  const { data } = useQuery({
    // Not under a persisted root: a stale answer from last launch would be
    // compared against and could only ever raise a false alarm.
    queryKey: ['remote-version'],
    queryFn: fetchRemoteVersion,
    enabled: Boolean(session),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;

    // This device wrote since the last poll, so the difference is its own.
    const localWrites = getLocalWriteCount();
    if (localWrites !== writesAtBaseline.current) {
      writesAtBaseline.current = localWrites;
      baseline.current = data;
      return;
    }

    const { next, change } = detectRemoteChange(baseline.current, data);
    baseline.current = next;

    if (change) {
      invalidateAfterWrite(queryClient, 'remote');
      setMessage(describeRemoteChange(change));
    }
  }, [data, queryClient]);

  // Signing out ends the session this baseline described.
  useEffect(() => {
    if (!session) baseline.current = null;
  }, [session]);

  // Derived rather than cleared: nothing is shown while signed out.
  return { message: session ? message : null, dismiss: () => setMessage(null) };
}
