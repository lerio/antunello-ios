/**
 * @vendored-from antunello-app:utils/transaction-utils.ts
 * @upstream-sha256 9431ae44b07b52b606e5cbe492b6288684fe44a57e715ff164a3aacb9c78e359
 * @vendored-on 2026-09-10
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
 * Transaction utilities: sorting and derived-row helpers.
 *
 * Provides functions for sorting transaction arrays by date (descending)
 * and then by creation timestamp (descending), both as immutable copies
 * and in-place mutations, plus helpers for derived/system-generated rows
 * (TR bonus rows and split instances) that link to an originating
 * transaction.
 *
 * @module utils/transaction-utils
 */

import { Transaction } from "./types";

/**
 * Sorts transactions by date (descending), then by created_at (descending).
 * Returns a new sorted array without mutating the original.
 *
 * @param transactions - The array of transactions to sort
 * @returns A new array sorted by date descending, then created_at descending
 */
export function sortTransactionsByDate(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Sorts transactions in place by date (descending), then by created_at (descending).
 * Mutates and returns the original array.
 *
 * @param transactions - The array of transactions to sort (mutated in place)
 * @returns The same array reference, now sorted in place
 */
export function sortTransactionsByDateInPlace(transactions: Transaction[]): Transaction[] {
  return transactions.sort((a, b) => {
    const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Whether the row is system-generated and read-only: TR bonus rows
 * (`bonus_kind`, persisted) or split instances (`split_is_read_only`,
 * UI-only).
 */
export function isReadOnlyTransaction(t: Transaction): boolean {
  return !!t.bonus_kind || !!t.split_is_read_only;
}

/**
 * The originating transaction id for a derived row, if any.
 */
export function parentTransactionId(t: Transaction): string | null {
  return t.parent_transaction_id ?? t.split_source_transaction_id ?? null;
}
