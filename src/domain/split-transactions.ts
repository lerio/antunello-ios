/**
 * @vendored-from antunello-app:utils/split-transactions.ts
 * @upstream-sha256 ea0d72bd9a81bef480dd9a17151a966f7685d5d61521763b99376a5f33db39ab
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
 * Split-across-year transaction expansion utilities.
 *
 * Provides functions for distributing the amount of a single transaction evenly
 * across 12 months (split across the year), handling partial-month display,
 * rounding to minor units for currency precision, and expanding original
 * split transactions into individual monthly instances for display in both
 * month and year views.
 *
 * @module utils/split-transactions
 */

import { Transaction } from './types'
import { getCurrencyFractionDigits } from './currency-amount-input'

const SPLIT_PARTS = 12

/**
 * Calculates the minor units factor (10^fractionDigits) for a given currency precision.
 * For example, EUR with 2 fraction digits returns 100.
 *
 * @param fractionDigits - Number of decimal places
 * @returns The factor for converting between major and minor currency units
 */
function getMinorUnitsFactor(fractionDigits: number): number {
  return Math.pow(10, Math.max(0, fractionDigits))
}

/**
 * Rounds an amount to the nearest minor unit for the given currency precision.
 *
 * @param amount - The amount to round in major units
 * @param fractionDigits - Number of decimal places for the currency
 * @returns The amount expressed in minor units (integer)
 */
function roundToMinorUnits(amount: number, fractionDigits: number): number {
  const factor = getMinorUnitsFactor(fractionDigits)
  return Math.sign(amount) * Math.round(Math.abs(amount) * factor)
}

/**
 * Converts minor units back to the major unit representation.
 *
 * @param minorUnits - The amount in minor units (integer)
 * @param fractionDigits - Number of decimal places for the currency
 * @returns The amount in major units
 */
function minorUnitsToAmount(minorUnits: number, fractionDigits: number): number {
  return minorUnits / getMinorUnitsFactor(fractionDigits)
}

/**
 * Calculates the rounded minor unit values for each split, distributing the
 * rounding remainder into the first month of the rolling window to avoid
 * rounding discrepancies across all 12 months.
 *
 * @param totalAmount - The total transaction amount to split
 * @param fractionDigits - Number of decimal places for the currency
 * @returns An object with the regular month minor unit amount and the first-month amount
 */
function getRoundedSplitMinorUnits(
  totalAmount: number,
  fractionDigits: number
): { regularMonthMinorUnits: number; firstMonthMinorUnits: number } {
  const totalMinorUnits = roundToMinorUnits(totalAmount, fractionDigits)
  // Divide in integer minor units. `totalAmount / 12` can land exactly on a
  // half-cent, where floating point rounds 72.025 down and SQL's numeric
  // round() rounds it up; that cent-level disagreement must not exist.
  const regularMonthMinorUnits =
    Math.sign(totalMinorUnits) *
    Math.floor(Math.abs(totalMinorUnits) / SPLIT_PARTS + 0.5)
  const firstMonthMinorUnits = totalMinorUnits - regularMonthMinorUnits * (SPLIT_PARTS - 1)

  return { regularMonthMinorUnits, firstMonthMinorUnits }
}

/**
 * Gets the rounded split amount for a specific month within a rolling
 * 12-month window starting at `splitStartMonth`.
 *
 * The first month of the window receives any rounding remainder to ensure
 * the sum of all 12 monthly amounts equals the original total.
 *
 * @param totalAmount - The total transaction amount to split across 12 months
 * @param month - The calendar month number (1-12) to get the split amount for
 * @param splitStartMonth - The calendar month (1-12) that starts the 12-month window
 * @param fractionDigits - Number of decimal places for the currency (default: 2)
 * @returns The rounded split amount for the specified month
 */
export function getRoundedSplitAmountForMonth(
  totalAmount: number,
  month: number,
  splitStartMonth: number,
  fractionDigits = 2
): number {
  const { regularMonthMinorUnits, firstMonthMinorUnits } = getRoundedSplitMinorUnits(totalAmount, fractionDigits)
  return month === splitStartMonth
    ? minorUnitsToAmount(firstMonthMinorUnits, fractionDigits)
    : minorUnitsToAmount(regularMonthMinorUnits, fractionDigits)
}

/**
 * Gets the rounded split amount for a specific month, safely handling
 * null and undefined total amounts by passing them through unchanged.
 *
 * @param totalAmount - The total transaction amount, or null/undefined
 * @param month - The calendar month number (1-12) to get the split amount for
 * @param splitStartMonth - The calendar month (1-12) that starts the 12-month window
 * @param fractionDigits - Number of decimal places for the currency (default: 2)
 * @returns The rounded split amount, or the original null/undefined value
 */
export function getRoundedOptionalSplitAmountForMonth(
  totalAmount: number | null | undefined,
  month: number,
  splitStartMonth: number,
  fractionDigits = 2
): number | null | undefined {
  if (totalAmount === undefined || totalAmount === null) {
    return totalAmount
  }

  return getRoundedSplitAmountForMonth(totalAmount, month, splitStartMonth, fractionDigits)
}

/**
 * Returns the number of days in a given month and year.
 *
 * @param year - The year
 * @param month - The month number (1-12)
 * @returns The number of days in the month
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Creates a date for a split transaction instance, ensuring the day
 * does not exceed the target month's maximum days (clamped to end of month).
 *
 * @param baseDate - The original transaction date
 * @param year - The target year for the instance
 * @param month - The target month (1-12) for the instance
 * @returns A new Date object for the split instance
 */
function getSplitInstanceDate(baseDate: Date, year: number, month: number): Date {
  const day = Math.min(baseDate.getDate(), daysInMonth(year, month))
  return new Date(
    year,
    month - 1,
    day,
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds()
  )
}

/**
 * Gets the display amount for a transaction, respecting split display amounts.
 * If the transaction has a split_display_amount, that value is returned.
 * Otherwise falls back to the original amount.
 *
 * @param transaction - The transaction to get the display amount for
 * @returns The amount to display (may be original or split-adjusted)
 */
export function getTransactionDisplayAmount(transaction: Transaction): number {
  if (transaction.split_display_amount !== undefined) {
    return transaction.split_display_amount
  }
  return transaction.amount
}

/**
 * Gets the display EUR amount for a transaction, respecting split display amounts.
 * If the transaction has a split_display_eur_amount, that value is returned.
 * Otherwise falls back to the original eur_amount.
 *
 * @param transaction - The transaction to get the display EUR amount for
 * @returns The EUR amount to display, or undefined if not available
 */
export function getTransactionDisplayEurAmount(transaction: Transaction): number | undefined {
  if (transaction.split_display_eur_amount !== undefined) {
    return transaction.split_display_eur_amount ?? undefined
  }
  return transaction.eur_amount
}

/**
 * Calculates the expected total split EUR amount for transactions not yet visible
 * in the current view. Sums the absolute EUR amounts of all split-across-year
 * transactions that are not currently shown as visible instances.
 *
 * @param allSplitTransactions - All split transactions in the year
 * @param visibleTransactions - The visible (already expanded) split instances
 * @returns The total expected EUR amount of non-visible split portions
 */
export function calculateExpectedSplitAmountEur(
  allSplitTransactions: ReadonlyArray<Transaction>,
  visibleTransactions: ReadonlyArray<Transaction>
): number {
  if (!allSplitTransactions.length) return 0

  const visibleSplitIds = new Set(
    visibleTransactions.filter((t) => t.split_across_year).map((t) => t.id)
  )

  let total = 0
  for (const tx of allSplitTransactions) {
    if (visibleSplitIds.has(tx.id)) continue

    const eurAmount =
      getTransactionDisplayEurAmount(tx) ??
      (tx.currency === 'EUR' ? getTransactionDisplayAmount(tx) : 0)

    if (eurAmount === 0 && tx.currency !== 'EUR') continue
    total += Math.abs(eurAmount)
  }

  return total
}

/**
 * Determines whether a target month falls within the rolling 12-month window
 * starting from a source transaction's month. The window covers the source
 * month and the 11 following months, potentially crossing into the next year.
 *
 * @param targetYear - The year of the month being checked
 * @param targetMonth - The month (1-12) being checked
 * @param sourceYear - The year of the original split transaction
 * @param sourceMonth - The month (1-12) of the original split transaction
 * @returns True if targetMonth is within [sourceMonth, sourceMonth+11] (wrapping years)
 */
function isMonthInRollingWindow(
  targetYear: number,
  targetMonth: number,
  sourceYear: number,
  sourceMonth: number
): boolean {
  const targetAbsolute = targetYear * 12 + (targetMonth - 1)
  const sourceAbsolute = sourceYear * 12 + (sourceMonth - 1)
  const offset = targetAbsolute - sourceAbsolute
  return offset >= 0 && offset < SPLIT_PARTS
}

/**
 * Returns all (month, year) pairs within a split source's rolling 12-month
 * window that fall inside the given target year.
 *
 * @param sourceYear - The year of the original split transaction
 * @param sourceMonth - The month (1-12) of the original split transaction
 * @param targetYear - The year to filter instances for
 * @returns Array of {month, year} objects for instances in the target year
 */
function getRollingWindowMonthsForYear(
  sourceYear: number,
  sourceMonth: number,
  targetYear: number
): Array<{ month: number; year: number }> {
  const instances: Array<{ month: number; year: number }> = []
  for (let offset = 0; offset < SPLIT_PARTS; offset += 1) {
    const windowMonth = sourceMonth + offset
    const actualYear = sourceYear + Math.floor((windowMonth - 1) / 12)
    const actualMonth = ((windowMonth - 1) % 12) + 1
    if (actualYear === targetYear) {
      instances.push({ month: actualMonth, year: actualYear })
    }
  }
  return instances
}

/**
 * Expands split-across-year transactions into individual monthly instances for
 * a specific month view. Uses a rolling 12-month window starting from each
 * source's own month, so cross-year split sources (e.g., a November 2025
 * transaction whose window reaches October 2026) are included when they
 * apply to the target month.
 *
 * @param monthTransactions - Transactions for the target month (some may be split-across-year)
 * @param splitTransactions - All split-across-year transactions (can span multiple years)
 * @param targetYear - The target year for the month view
 * @param targetMonth - The target month (1-12) for the view
 * @param now - Current date (defaults to new Date()) for filtering future instances
 * @returns Combined array of regular and expanded split transaction instances
 */
export function expandSplitTransactionsForMonth(
  monthTransactions: Transaction[],
  splitTransactions: Transaction[],
  targetYear: number,
  targetMonth: number,
  now = new Date()
): Transaction[] {
  const regularTransactions = monthTransactions.filter((t) => !t.split_across_year)
  const splitInstances: Transaction[] = []

  for (const splitSource of splitTransactions) {
    const baseDate = new Date(splitSource.date)
    if (Number.isNaN(baseDate.getTime())) continue

    const sourceYear = baseDate.getFullYear()
    const sourceMonth = baseDate.getMonth() + 1

    if (!isMonthInRollingWindow(targetYear, targetMonth, sourceYear, sourceMonth)) continue

    const instanceDate = getSplitInstanceDate(baseDate, targetYear, targetMonth)
    if (instanceDate.getTime() > now.getTime()) continue

    const isOriginalMonth = sourceMonth === targetMonth && sourceYear === targetYear
    const amountFractionDigits = getCurrencyFractionDigits(splitSource.currency)
    const splitAmount = getRoundedSplitAmountForMonth(splitSource.amount, targetMonth, sourceMonth, amountFractionDigits)
    const splitEurAmount = getRoundedOptionalSplitAmountForMonth(splitSource.eur_amount, targetMonth, sourceMonth, 2)

    // Position of this instance within the 12-month window (0 = source month)
    const instanceOffset =
      targetYear * 12 + (targetMonth - 1) - (sourceYear * 12 + (sourceMonth - 1))
    const remainingCount = SPLIT_PARTS - 1 - instanceOffset

    if (isOriginalMonth) {
      splitInstances.push({
        ...splitSource,
        split_is_read_only: false,
        split_source_transaction_id: null,
        split_display_amount: splitAmount,
        split_display_eur_amount: splitEurAmount,
        split_remaining_count: remainingCount,
      })
      continue
    }

    splitInstances.push({
      ...splitSource,
      id: `${splitSource.id}::split::${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      amount: splitAmount,
      eur_amount: splitEurAmount ?? undefined,
      date: instanceDate.toISOString(),
      split_is_read_only: true,
      split_source_transaction_id: splitSource.id,
      split_display_amount: splitAmount,
      split_display_eur_amount: splitEurAmount,
      split_remaining_count: remainingCount,
    })
  }

  return [...regularTransactions, ...splitInstances]
}

/**
 * Expands split-across-year transactions into individual monthly instances for
 * an entire year view. Uses a rolling 12-month window starting from each
 * source's own month, so only instances that fall within the target year
 * are generated. Sources from the previous year whose window crosses into
 * the target year are included.
 *
 * @param yearTransactions - All transactions to consider (can span multiple years)
 * @param targetYear - The target year to expand instances for
 * @param now - Current date (defaults to new Date()) for filtering future instances
 * @returns Combined array of regular and expanded split transaction instances for the full year
 */
export function expandSplitTransactionsForYear(
  yearTransactions: Transaction[],
  targetYear: number,
  now = new Date()
): Transaction[] {
  const regularTransactions = yearTransactions.filter((t) => !t.split_across_year)
  const splitSources = yearTransactions.filter((t) => t.split_across_year)
  const splitInstances: Transaction[] = []

  for (const splitSource of splitSources) {
    const baseDate = new Date(splitSource.date)
    if (Number.isNaN(baseDate.getTime())) continue

    const sourceYear = baseDate.getFullYear()
    const sourceMonth = baseDate.getMonth() + 1
    const amountFractionDigits = getCurrencyFractionDigits(splitSource.currency)

    const windowMonths = getRollingWindowMonthsForYear(sourceYear, sourceMonth, targetYear)

    for (const { month, year } of windowMonths) {
      const instanceDate = getSplitInstanceDate(baseDate, year, month)
      if (instanceDate.getTime() > now.getTime()) continue

      const isOriginalMonth = sourceMonth === month && sourceYear === year
      const splitAmount = getRoundedSplitAmountForMonth(splitSource.amount, month, sourceMonth, amountFractionDigits)
      const splitEurAmount = getRoundedOptionalSplitAmountForMonth(splitSource.eur_amount, month, sourceMonth, 2)

      // Position of this instance within the 12-month window (0 = source month)
      const instanceOffset =
        year * 12 + (month - 1) - (sourceYear * 12 + (sourceMonth - 1))
      const remainingCount = SPLIT_PARTS - 1 - instanceOffset

      if (isOriginalMonth) {
        splitInstances.push({
          ...splitSource,
          split_is_read_only: false,
          split_source_transaction_id: null,
          split_display_amount: splitAmount,
          split_display_eur_amount: splitEurAmount,
          split_remaining_count: remainingCount,
        })
      } else {
        splitInstances.push({
          ...splitSource,
          id: `${splitSource.id}::split::${year}-${String(month).padStart(2, '0')}`,
          amount: splitAmount,
          eur_amount: splitEurAmount ?? undefined,
          date: instanceDate.toISOString(),
          split_is_read_only: true,
          split_source_transaction_id: splitSource.id,
          split_display_amount: splitAmount,
          split_display_eur_amount: splitEurAmount,
          split_remaining_count: remainingCount,
        })
      }
    }
  }

  return [...regularTransactions, ...splitInstances]
}
