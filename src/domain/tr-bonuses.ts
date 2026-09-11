/**
 * @vendored-from antunello-app:utils/tr-bonuses.ts
 * @upstream-sha256 3296b306fd65c4931495f757a5ed5d6164a0fe49c906f4c7041e1d1f342a5cf1
 * @vendored-on 2026-09-11
 * @parity exact
 * @divergences none
 *
 * DO NOT EDIT THIS COPY IN ISOLATION.
 *
 * This file is vendored verbatim from the web app. The hash above is of the
 * upstream file after alias rewriting; it must equal the hash of everything
 * below this header. If you change the web implementation, re-run
 * `npm run vendor` and follow PARITY.md.
 */
/**
 * Builds the system-generated "bonus" transactions for Trade Republic card
 * payments: a SAVEBACK income row and a Round-up money transfer
 * (cash → wealth). Bonus rows are linked to their parent card transaction
 * via `parent_transaction_id` and are unmodifiable/undeletable (see
 * migration 016 and the mutation guards).
 *
 * Both bonuses are independent: a missing fund mapping skips one with a
 * warning but never blocks the other or the card transaction itself.
 */

import type { FundCategory, Transaction } from './types';
import { generateTransferTitle } from './money-transfer-validation';

/** The subset of pending_transactions.data this builder reads. */
interface PendingBonusData {
  date: string;
  fund_category_id?: string | null;
  saveback_amount?: number;
  round_up_amount?: number;
  wealth_fund_category_id?: string | null;
}

export interface TrBonusBuildResult {
  rows: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[];
  /** Human-readable reasons why a bonus was skipped (surfaced as toasts). */
  warnings: string[];
}

/**
 * Build the bonus rows for an accepted TR card transaction.
 *
 * @param pending - The pending transaction being accepted (user_id + data).
 * @param parentId - The persisted card transaction row id.
 * @param funds - Fund categories, used for transfer title names.
 */
export function buildTrBonusRows(
  pending: { user_id: string; data: PendingBonusData },
  parentId: string,
  funds: FundCategory[],
): TrBonusBuildResult {
  const { user_id, data } = pending;
  const rows: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] = [];
  const warnings: string[] = [];

  const wealthFundId = data.wealth_fund_category_id || null;
  const cashFundId = data.fund_category_id || null;

  const fundName = (id: string | null, fallback: string) =>
    funds.find((f) => f.id === id)?.name || fallback;

  // EUR conversion fields are applied by addBonusTransactions through the
  // same convertAndUpdateCurrency path as addTransaction.
  const common = {
    user_id,
    currency: 'EUR',
    date: data.date,
    hide_from_totals: false,
    split_across_year: false,
    parent_transaction_id: parentId,
  };

  // ---- Saveback: income into the wealth fund ----
  if (data.saveback_amount && wealthFundId) {
    rows.push({
      ...common,
      amount: data.saveback_amount,
      type: 'income',
      main_category: 'Primary Income',
      sub_category: 'Investment Income',
      title: 'SAVEBACK',
      fund_category_id: wealthFundId,
      is_money_transfer: false,
      target_fund_category_id: null,
      bonus_kind: 'saveback',
    });
  } else if (data.saveback_amount) {
    warnings.push('Saveback not created: map the Saveback / Round-up Fund in Settings first');
  }

  // ---- Round up: money transfer from cash to the wealth fund ----
  if (data.round_up_amount && wealthFundId && cashFundId && cashFundId !== wealthFundId) {
    rows.push({
      ...common,
      amount: data.round_up_amount,
      type: 'expense',
      main_category: 'Money Transfer',
      sub_category: 'Money Transfer',
      title: generateTransferTitle(
        fundName(cashFundId, 'Trade Republic'),
        fundName(wealthFundId, 'Trade Republic Wealth'),
      ),
      fund_category_id: cashFundId,
      target_fund_category_id: wealthFundId,
      is_money_transfer: true,
      bonus_kind: 'round_up',
    });
  } else if (data.round_up_amount) {
    const reason = !wealthFundId
      ? 'map the Saveback / Round-up Fund in Settings first'
      : !cashFundId
        ? 'map the Trade Republic cash fund in Settings first'
        : 'cash and wealth funds must be different';
    warnings.push(`Round up not created: ${reason}`);
  }

  return { rows, warnings };
}
