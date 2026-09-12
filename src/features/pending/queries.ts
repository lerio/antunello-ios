/**
 * Pending bank rows: reads, and the two status writes.
 *
 * Accepting a row does *not* delete it — it is marked `added`, which keeps the
 * `external_id` around so the next sync recognises it and does not re-import the
 * same payment. The same goes for skipping. Nothing here ever removes a row.
 */

import type { PendingStatus, PendingTransaction } from '@/features/pending/types';
import { supabase } from '@/lib/supabase';

/**
 * Fetches the rows still awaiting review.
 *
 * RLS scopes this to the signed-in user, so no explicit `user_id` filter is
 * needed — but the web app passes one anyway, and a query that relies on a
 * policy to be correct is one policy change away from returning somebody else's
 * data to a screen that would happily render it.
 *
 * @param userId The signed-in user's id.
 * @returns Pending rows, newest first.
 */
export async function fetchPendingTransactions(userId: string): Promise<PendingTransaction[]> {
  const { data, error } = await supabase
    .from('pending_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PendingTransaction[];
}

/**
 * Moves a pending row out of the review queue.
 *
 * @param id The pending row's id.
 * @param status `added` when it was accepted, `dismissed` when it was skipped.
 */
export async function setPendingStatus(id: string, status: PendingStatus): Promise<void> {
  const { error } = await supabase
    .from('pending_transactions')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
