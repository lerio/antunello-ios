/**
 * Builds a form state from an existing transaction, for editing and for
 * reviewing a pending bank import.
 */

import { MONEY_TRANSFER_CATEGORY, UNRESOLVED_FUND_NAME, type FormState, initialFormState, type FormMode } from '@/features/transactions/form/reducer';

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
 * Resolves a stored fund id to a reference the form can hold.
 *
 * **A fund whose name cannot be looked up keeps its id.** That is the whole
 * point of this function, and the first version got it wrong: it returned `null`
 * when the lookup missed, which turned "I could not name this fund" into "there
 * is no fund" — and the form then wrote that back on save, detaching the
 * transaction from the fund its balance is summed into.
 *
 * The lookup misses for four reasons, and all four used to be data loss:
 *
 *  - The fund has been **deactivated**, so `useFunds` no longer lists it.
 *  - The funds have not **loaded yet** — common, because the transaction is
 *    served straight from the query cache while funds take a round trip.
 *  - The funds fetch **failed**, which the edit screen cannot tell apart from
 *    an empty list.
 *  - The provider's mapping points at a fund that no longer exists.
 *
 * Carrying the id with a stand-in name keeps the display honest (the picker
 * shows "Unavailable fund") while leaving the id intact for the write.
 *
 * @param fundId The stored id, if any.
 * @param isTransfer Whether the transaction is a transfer.
 * @param lookupFund Resolves an id to a name, when the fund list has it.
 * @returns A fund reference, or null when there is genuinely no fund.
 */
function resolveFund(
  fundId: string | null | undefined,
  isTransfer: boolean,
  lookupFund?: FundLookup,
): FormState['sourceFund'] {
  if (!fundId) return null;

  const fund = lookupFund?.(fundId);
  if (fund) return { id: fund.id, name: fund.name };

  // A transfer is the one case that must *not* keep an unresolvable id.
  // `normalize` regenerates a transfer's title from its funds' names, so a
  // stand-in name would rewrite the title to "Unavailable fund" on the first
  // keystroke. Leaving it null makes `validateMoneyTransferFields` block the
  // save instead — loud, and recoverable by picking a fund.
  if (isTransfer) return null;

  return { id: fundId, name: UNRESOLVED_FUND_NAME };
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

  const sourceFund = resolveFund(transaction.fund_category_id, isTransfer, lookupFund);
  const targetFund = resolveFund(transaction.target_fund_category_id, isTransfer, lookupFund);

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
    sourceFund,
    targetFund: isTransfer ? targetFund : null,
  };
}
