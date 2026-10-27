/**
 * @vendored-from antunello-app:utils/money-transfer-validation.ts
 * @upstream-sha256 5c2bbf91df54143efab30ffa12b5b83a609f8f83df6d1117f7d4caa850e68119
 * @vendored-on 2026-10-27
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
 * Money transfer validation and title generation utilities.
 *
 * Provides functions for validating money transfer transactions between
 * fund categories, generating descriptive transfer titles, and checking
 * whether a transaction is a money transfer.
 *
 * @module utils/money-transfer-validation
 */

import { Transaction } from './types'

/**
 * Generates a formatted title for a money transfer.
 * Format: "Source Fund ➡️ Target Fund"
 *
 * @param sourceName - The display name of the source fund category
 * @param targetName - The display name of the target fund category
 * @returns The formatted transfer title string with arrow separator
 */
export function generateTransferTitle(sourceName: string, targetName: string): string {
  return `${sourceName} ➡️ ${targetName}`
}

/**
 * Checks if a transaction is a money transfer based on the is_money_transfer flag.
 *
 * @param transaction - The transaction to check
 * @returns True if the transaction is a money transfer
 */
export function isMoneyTransfer(transaction: Transaction): boolean {
  return transaction.is_money_transfer === true
}
