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
 * The pending row is only marked `added` after everything else succeeded. That
 * was meant to make failure safe — a queued row can be reviewed again — but for
 * a failure *after* the money is committed it did the opposite: the row stayed
 * queued with the transaction already written, and reviewing it again inserted a
 * second copy. There is no idempotency key on the insert. So every failure past
 * the first write now rolls the card row back, which is what makes the retry
 * safe rather than duplicating.
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
import { messageOf } from '@/lib/errors';
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

      /**
       * Removes the card row this accept just wrote.
       *
       * Used by every failure that happens *after* the money is committed, so
       * the accept can be retried cleanly. Its own failure is logged rather
       * than swallowed: if it does not succeed the card row survives, and
       * without a trace there is nothing to correlate the duplicate against.
       */
      async function rollback(reason: string): Promise<never> {
        try {
          await deleteTransaction.mutateAsync(card.id);
        } catch (rollbackError) {
          console.error(
            'Rollback failed; the transaction row survives and the pending row is still queued:',
            card.id,
            messageOf(rollbackError),
          );
          throw new Error(
            `The transaction was saved but ${reason}, and removing it also failed — it is still ` +
              `there and still queued, so check the transactions list before retrying.`,
          );
        }

        throw new Error(`The transaction was saved but ${reason}, so it has been removed.`);
      }

      const { rows, warnings } = buildTrBonusRows(pending, card.id, [...funds]);

      if (rows.length > 0) {
        try {
          await addBonuses.mutateAsync(rows);
        } catch (bonusError) {
          return rollback(`its bonuses were not (${messageOf(bonusError)})`);
        }
      }

      // The last step, and the one that must not be skipped. Failing here used
      // to leave the money written while the row stayed queued — and the user,
      // just told the save failed, would review it again and insert a second
      // copy. There is no idempotency key on the insert, so a duplicate here is
      // a real duplicate. Rolling back is what makes a retry safe.
      try {
        await setPendingStatus(pending.id, 'added');
      } catch (statusError) {
        return rollback(`the bank row could not be closed (${messageOf(statusError)})`);
      }

      return { warnings };
    },

    // Fires whether the accept succeeded or the compensation rolled it back;
    // either way the month and the queue have both moved.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.pending() });
    },
  });
}
