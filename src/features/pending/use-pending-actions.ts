/**
 * Accepting and skipping a pending bank row.
 *
 * Accepting is the one write in the app that is not a single statement, and the
 * order matters:
 *
 *   1. Insert the card transaction the user just reviewed.
 *   2. Build its Trade Republic bonuses from the pending data, if it has any.
 *   3. Insert the bonuses **together**. If that fails, delete the card row
 *      again and report the failure.
 *   4. Mark the pending row `added`, which is what takes it out of the queue.
 *
 * Step 3's compensation is the part worth keeping. Without it a failure leaves
 * the card transaction saved and the pending row still pending — so reviewing it
 * again inserts a second copy, and the duplicate is a real transaction with a
 * real amount. Deleting the row puts the user back where they started, able to
 * accept again or skip.
 *
 * The pending row is only marked `added` after everything else succeeded, so a
 * failure anywhere leaves it queued.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { buildTrBonusRows } from '@/domain/tr-bonuses';
import type { FundCategory } from '@/domain/types';
import { setPendingStatus } from '@/features/pending/queries';
import type { PendingTransaction } from '@/features/pending/types';
import {
  useAddBonusTransactions,
  useAddTransaction,
  useDeleteTransaction,
  type TransactionInput,
} from '@/features/transactions/mutations';
import { qk } from '@/lib/query-keys';

export type AcceptResult = {
  /** Reasons a bonus was skipped. Each is worth showing; none is fatal. */
  warnings: string[];
};

/**
 * Skips a pending row.
 *
 * @returns A mutation; call `.mutateAsync(pending.id)` to run it.
 */
export function useDismissPending() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await setPendingStatus(id, 'dismissed');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.pending() });
    },
  });
}

/**
 * Accepts a pending row: writes the transaction, its bonuses, and closes the row.
 *
 * @returns A mutation; call `.mutateAsync({ pending, input, funds })` to run it.
 */
export function useAcceptPending() {
  const queryClient = useQueryClient();

  const addTransaction = useAddTransaction();
  const addBonuses = useAddBonusTransactions();
  const deleteTransaction = useDeleteTransaction();

  return useMutation({
    mutationFn: async ({
      pending,
      input,
      funds,
    }: {
      pending: PendingTransaction;
      input: TransactionInput;
      funds: readonly FundCategory[];
    }): Promise<AcceptResult> => {
      const card = await addTransaction.mutateAsync(input);

      const { rows, warnings } = buildTrBonusRows(pending, card.id, [...funds]);

      if (rows.length > 0) {
        try {
          await addBonuses.mutateAsync(rows);
        } catch (bonusError) {
          // Compensate. If this also fails there is nothing further to try, and
          // the error below is the one that matters — the card row is still
          // there and the pending row is still queued.
          await deleteTransaction.mutateAsync(card.id).catch(() => undefined);

          throw new Error(
            `The transaction was saved but its bonuses were not, so it has been removed. ${
              bonusError instanceof Error ? bonusError.message : String(bonusError)
            }`,
          );
        }
      }

      await setPendingStatus(pending.id, 'added');

      return { warnings };
    },

    // Fires whether the accept succeeded or the compensation rolled it back;
    // either way the month and the queue have both moved.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.pending() });
    },
  });
}
