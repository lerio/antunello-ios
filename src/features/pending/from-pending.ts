/**
 * Turns a pending bank row into the review form's starting state.
 *
 * The web app builds this object inline in the transactions page and casts it to
 * `any`, so nothing checks that the fields it names are the ones the form reads.
 * Here it is a function with a return type, which is the difference between a
 * rename breaking the review screen at build time and breaking it silently in
 * the reviewer's hands.
 *
 * The mapping is deliberately narrow — the bank's title, amount, currency, date,
 * type and fund, and nothing else. Categories are left empty on purpose: they are
 * the thing the user is being asked for, and pre-filling a guess would invite
 * accepting it.
 */

import type { FundCategory } from '@/domain/types';
import {
  UNRESOLVED_FUND_NAME,
  initialFormState,
  type FormState,
} from '@/features/transactions/form/reducer';
import type { PendingTransaction } from '@/features/pending/types';

/**
 * The form state for reviewing a pending transaction.
 *
 * @param pending The bank row being reviewed.
 * @param funds The funds, used to resolve the provider's fund id to a name so
 *   the picker shows something before the user opens it.
 * @returns Form state in the `accept-pending` mode.
 */
export function formStateFromPending(
  pending: PendingTransaction,
  funds: readonly FundCategory[] = [],
): FormState {
  const { data } = pending;

  const fund = data.fund_category_id
    ? funds.find((candidate) => candidate.id === data.fund_category_id)
    : undefined;

  return {
    ...initialFormState('accept-pending'),
    type: data.type ?? 'expense',
    // The bank reports a sign; the form works in magnitudes and takes the
    // direction from the type. Passing a negative expense would fail validation
    // on an amount the user never chose.
    amount: String(Math.abs(data.amount)),
    currency: asCurrency(data.currency),
    title: data.title ?? '',
    date: new Date(data.date),
    // The bank's mapping is the only reason these rows are attributed to a fund
    // at all, so an id whose name cannot be resolved keeps the id and takes a
    // stand-in label. Dropping it here would silently discard the mapping the
    // sync went to the trouble of recording, and the review screen has no fund
    // control to put it back. See `resolveFund` in `from-transaction.ts`.
    sourceFund: data.fund_category_id
      ? {
          id: data.fund_category_id,
          name: fund?.name ?? UNRESOLVED_FUND_NAME,
        }
      : null,
  };
}

/** Whether a currency string is one the form offers. */
function asCurrency(value: string): FormState['currency'] {
  return value === 'USD' || value === 'JPY' ? value : 'EUR';
}

/** Whether a pending row carries Trade Republic bonuses to create on accept. */
export function hasTrBonuses(pending: PendingTransaction): boolean {
  return Boolean(pending.data.saveback_amount || pending.data.round_up_amount);
}
