/**
 * Bank-imported transactions awaiting review.
 *
 * A pending row is a *proposal*, not a transaction: the sync service writes what
 * the bank reported into a `data` column and the user decides whether it becomes
 * a real transaction. Keeping it in its own shape rather than pretending it is a
 * `Transaction` is what stops a half-reviewed row from ever reaching a total.
 */

/** Where a pending row is in its life. */
export type PendingStatus = 'pending' | 'added' | 'dismissed';

/**
 * What the bank reported, plus whatever the sync service managed to work out.
 *
 * Most fields are optional because the shape depends on the provider: a Trade
 * Republic timeline entry carries the saveback and round-up amounts and the
 * wealth fund it credits, while an Enable Banking feed entry carries only the
 * description and the amount.
 */
export type PendingData = {
  amount: number;
  currency: string;
  /** Defaults to an expense when the provider did not say. */
  type?: 'expense' | 'income';
  main_category?: string;
  sub_category?: string;
  title: string;
  /** Full ISO timestamp. */
  date: string;
  account_iban?: string;
  fund_category_id?: string | null;
  /** The amount in the account's own currency, before conversion. */
  original_amount?: number;

  /** When the bank posted it, `YYYY-MM-DD`. */
  booking_date?: string | null;
  /** When the money actually moved, `YYYY-MM-DD`. */
  value_date?: string | null;
  /** When the payment was initiated, `YYYY-MM-DD`. */
  transaction_date?: string | null;

  /** Trade Republic: saveback earned by this card payment, in EUR. */
  saveback_amount?: number;
  /** Trade Republic: round-up moved to the wealth fund, in EUR. */
  round_up_amount?: number;
  /** Trade Republic: the wealth fund those two credit. */
  wealth_fund_category_id?: string | null;
};

export type PendingTransaction = {
  id: string;
  user_id: string;
  status: PendingStatus;
  /** The provider's own id, which is what makes a re-sync idempotent. */
  external_id: string;
  created_at: string;
  updated_at: string;
  data: PendingData;
  /** The provider's payload, kept for debugging. Not read by the app. */
  raw_data?: unknown;
};
