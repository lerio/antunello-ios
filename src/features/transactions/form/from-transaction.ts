/**
 * Builds a form state from an existing transaction, for editing and for
 * reviewing a pending bank import.
 */

import { MONEY_TRANSFER_CATEGORY, type FormState, initialFormState, type FormMode } from '@/features/transactions/form/reducer';

/** A fund reference resolved from the fund list, when available. */
type FundLookup = (id: string) => { id: string; name: string } | undefined;

/** The subset of a transaction the form reads. */
export type TransactionLike = {
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  title: string;
  main_category: string;
  sub_category?: string;
  date: string;
  hide_from_totals?: boolean;
  split_across_year?: boolean;
  is_money_transfer?: boolean;
  fund_category_id?: string | null;
  target_fund_category_id?: string | null;
};

/** Currencies the form accepts, so an unexpected one cannot reach the picker. */
function asCurrency(value: string): FormState['currency'] {
  return value === 'USD' || value === 'JPY' ? value : 'EUR';
}

/**
 * Converts a stored transaction into form state.
 *
 * @param transaction The row being edited.
 * @param mode Which entry mode the form is in.
 * @param lookupFund Resolves a fund id to a name, so the transfer pickers can
 *   show something before the fund list loads.
 * @returns Form state reflecting the transaction.
 */
export function formStateFromTransaction(
  transaction: TransactionLike,
  mode: FormMode,
  lookupFund?: FundLookup,
): FormState {
  const isTransfer =
    transaction.is_money_transfer === true ||
    transaction.main_category === MONEY_TRANSFER_CATEGORY;

  const sourceFund =
    transaction.fund_category_id && lookupFund
      ? (lookupFund(transaction.fund_category_id) ?? null)
      : null;
  const targetFund =
    transaction.target_fund_category_id && lookupFund
      ? (lookupFund(transaction.target_fund_category_id) ?? null)
      : null;

  return {
    ...initialFormState(mode),
    type: transaction.type,
    isMoneyTransferMode: isTransfer,
    // Formatted rather than raw: the amount field is a string, and 12.5 must
    // read as "12.50" for a euro transaction.
    amount: String(transaction.amount),
    currency: asCurrency(transaction.currency),
    title: transaction.title ?? '',
    mainCategory: transaction.main_category ?? '',
    subCategory: transaction.sub_category ?? '',
    date: new Date(transaction.date),
    hideFromTotals: transaction.hide_from_totals ?? false,
    splitAcrossYear: transaction.split_across_year ?? false,
    sourceFund: sourceFund ?? null,
    targetFund: isTransfer ? (targetFund ?? null) : null,
  };
}
