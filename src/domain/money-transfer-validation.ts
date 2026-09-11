/**
 * @vendored-from antunello-app:utils/money-transfer-validation.ts
 * @upstream-sha256 a332fd9294f5e56c82794dccb7e3a680d206e854779e1edec06df0c0fb236b74
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
 * Validates a money transfer transaction.
 * Checks that source and target fund categories are present, different from
 * each other, and the amount is positive.
 *
 * @param data - Partial transaction data to validate, expected to contain
 *               fund_category_id, target_fund_category_id, and amount
 * @returns An array of error message strings; empty array if valid
 */
export function validateMoneyTransfer(data: Partial<Transaction>): string[] {
  const errors: string[] = []

  if (!data.fund_category_id) {
    errors.push('Source fund is required')
  }

  if (!data.target_fund_category_id) {
    errors.push('Target fund is required')
  }

  if (data.fund_category_id && data.target_fund_category_id &&
      data.fund_category_id === data.target_fund_category_id) {
    errors.push('Source and target funds must be different')
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  return errors
}

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
