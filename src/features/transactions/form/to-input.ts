/**
 * Turns form state into the payload the mutation writes.
 *
 * Extracted from the form component so it can be tested: it builds the row that
 * every write in the app goes through, and it was inline and unreachable from a
 * test until now.
 *
 * The fund id it writes is the reason that matters. It comes from form state,
 * which is seeded from the stored row, so it is only correct if the seeding
 * preserves the id even when the fund's *name* cannot be resolved — see
 * `formStateFromTransaction`. A missing name is a display problem; a missing id
 * is a data-loss one, because `get_fund_balances` sums by fund.
 */

import type { FormState } from '@/features/transactions/form/reducer';
import type { TransactionInput } from '@/features/transactions/mutations';

/**
 * Builds the write payload from the form's state.
 *
 * @param state The form as it stands.
 * @returns The payload.
 */
export function toInput(state: FormState): TransactionInput {
  return {
    amount: Number(state.amount),
    currency: state.currency,
    type: state.type,
    title: state.title.trim(),
    main_category: state.mainCategory,
    sub_category: state.subCategory,
    date: state.date.toISOString(),
    // A transfer only moves money between the user's own funds, so it can never
    // meaningfully be excluded from totals — the web app forces it off.
    hide_from_totals: state.isMoneyTransferMode ? false : state.hideFromTotals,
    split_across_year: state.splitAcrossYear,
    is_money_transfer: state.isMoneyTransferMode,
    fund_category_id: state.sourceFund?.id ?? null,
    target_fund_category_id: state.isMoneyTransferMode ? (state.targetFund?.id ?? null) : null,
  };
}
