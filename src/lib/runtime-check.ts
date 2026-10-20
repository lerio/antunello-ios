/**
 * Runtime guards for capabilities the app assumes but cannot verify at build
 * time, because they depend on the JavaScript engine actually running on the
 * device rather than on the bundler or the test environment.
 *
 * These are cheap, run once at startup in development, and exist to turn a
 * silent data-corruption bug into a loud, immediate error.
 */

import { formatCurrency } from '../domain/currency';
import { getCurrencyFractionDigits } from '../domain/currency-amount-input';

/** Currency -> expected fraction digits, for the currencies the app supports. */
const EXPECTED_FRACTION_DIGITS: Record<string, number> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  JPY: 0,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  CNY: 2,
};

/**
 * Asserts that `Intl` behaves as the split engine requires.
 *
 * Why this matters: `split-transactions.ts` asks `getCurrencyFractionDigits`
 * for the decimal precision of a transaction's currency, then rounds each of
 * the twelve monthly slices in minor units. Hermes ships a less complete `Intl`
 * than V8. If it reports 2 digits for JPY, yen are treated as having cents and
 * every JPY split is wrong by a factor of 100 — and the twelve slices will no
 * longer sum to the source amount.
 *
 * That failure is invisible on a correctly-behaving engine, so it would only
 * ever surface as wrong money on the device. Hence this explicit check.
 *
 * @throws {Error} If `Intl` disagrees with the expected table.
 */
export function assertIntlSupport(): void {
  const wrong: string[] = [];

  for (const [currency, expected] of Object.entries(EXPECTED_FRACTION_DIGITS)) {
    let actual: number;
    try {
      actual = getCurrencyFractionDigits(currency);
    } catch (error) {
      throw new Error(
        `Intl is unavailable for currency formatting (${currency}): ${
          error instanceof Error ? error.message : String(error)
        }. Split amounts cannot be computed safely.`,
      );
    }
    if (actual !== expected) {
      wrong.push(`${currency}: expected ${expected}, got ${actual}`);
    }
  }

  if (wrong.length > 0) {
    throw new Error(
      `Intl reports unexpected fraction digits, which would corrupt split ` +
        `rounding:\n  ${wrong.join('\n  ')}\n` +
        `Replace the Intl call in src/domain/currency-amount-input.ts with a ` +
        `static currency table and re-vendor as an 'adapted' divergence.`,
    );
  }
}

/**
 * Asserts that currency formatting behaves as the app expects.
 *
 * `formatCurrency` renders EUR in German CLDR data (`5.448,96 €`), matching the
 * web app rather than letting the platform pick. That makes the output depend on
 * the engine's ICU data, which differs between V8 and Hermes.
 *
 * The assertions deliberately test *properties* — which separator is used, how
 * many decimals survive — rather than exact strings. Exact matches would fail on
 * a legitimate CLDR revision (the space before `€` is a non-breaking space, for
 * instance) while telling us nothing useful. Properties catch the failures that
 * matter: a swapped decimal separator, or yen gaining cents.
 *
 * @throws {Error} If formatting diverges from the expected convention.
 */
export function assertCurrencyFormatting(): void {
  const problems: string[] = [];

  // Small amounts keep the decimal separator unambiguous. The four-digit check
  // below is the regression guard for CLDR's minimumGroupingDigits: Italian
  // leaves 5448,96 ungrouped, which is why EUR uses German data.
  const eur = formatCurrency(0.5, 'EUR');
  if (!eur.includes(',50')) {
    problems.push(`EUR decimal separator should be ",": got "${eur}"`);
  }

  const grouped = formatCurrency(5448.96, 'EUR');
  if (!grouped.includes('5.448,96')) {
    problems.push(`EUR should group four-digit amounts: got "${grouped}"`);
  }

  const usd = formatCurrency(0.5, 'USD');
  if (!usd.includes('.50')) {
    problems.push(`USD decimal separator should be ".": got "${usd}"`);
  }

  // Yen has no minor unit, so 1234.6 must round to 1235 rather than keep the
  // 6. Comparing digits only sidesteps the thousands separator, which is
  // legitimately a comma in "￥1,235".
  const jpyDigits = formatCurrency(1234.6, 'JPY').replace(/\D/g, '');
  if (jpyDigits !== '1235') {
    problems.push(
      `JPY should round to whole yen: 1234.6 formatted as "${formatCurrency(1234.6, 'JPY')}"`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Currency formatting differs from the web app, so amounts would render ` +
        `differently on the two:\n  ${problems.join('\n  ')}`,
    );
  }
}

/**
 * Runs every runtime guard, logging a single summary line in development.
 *
 * Call once from the root layout, before rendering anything that formats money.
 */
export function runRuntimeChecks(): void {
  assertIntlSupport();
  assertCurrencyFormatting();
  if (__DEV__) {
    console.log('[runtime-check] Intl precision and currency formatting verified');
  }
}
