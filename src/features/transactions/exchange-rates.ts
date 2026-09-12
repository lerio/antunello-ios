/**
 * Currency conversion, with rates cached in the `exchange_rates` table.
 *
 * A reimplementation rather than a port of the web app's 534-line
 * `currency-conversion.ts`, which is I/O-bound throughout. The behaviour that
 * matters is reproduced exactly, because every non-EUR write depends on it:
 * getting the rate direction or the rounding wrong would put the wrong euro
 * figure on every foreign transaction.
 *
 * ## The rate direction
 *
 * Frankfurter quotes **1 EUR = X target**, so converting *to* EUR means
 * **dividing**. A JPY transaction of ¥1,000 at a rate of 165 becomes €6.06, not
 * €165,000.
 *
 * ## The fallback chain
 *
 * A rate for an exact date may not exist — weekends and holidays have no ECB
 * fixing. Rather than failing the write, the last attempt falls back to the most
 * recent cached rate and flags the result `isMissing`, so the transaction still
 * saves with a usable euro amount and the gap is recorded.
 *
 * ## What is deliberately absent
 *
 * The web module also carries batched conversion, a retry pass over previously
 * missing dates, and a scan for which dates are missing. All three exist for CSV
 * import and the admin screen, neither of which this app has.
 */

import type { ExchangeRate } from '@/domain/types';
import { supabase } from '@/lib/supabase';

/**
 * Frankfurter is the ECB's published rate feed. Free, no key, no auth.
 *
 * This host issues a permanent redirect to `api.frankfurter.dev/v1/…`. The URL
 * is kept as-is rather than pointed at the new host directly, so that both apps
 * resolve rates through the same path — the response shape is identical either
 * way, and `fetch` follows the redirect transparently.
 */
const FRANKFURTER_BASE = 'https://api.frankfurter.app';

const DEFAULT_RETRIES = 3;

export type ConversionResult = {
  /** The amount expressed in EUR. */
  eurAmount: number;
  /** The rate used, quoted as 1 EUR = `exchangeRate` of the source currency. */
  exchangeRate: number;
  /** The date the rate actually applies to, which may precede the request. */
  rateDate: string;
  /** True when `rateDate` is a substitute for the requested date. */
  isMissing: boolean;
};

/**
 * The most recent cached rate for a currency, whatever its date.
 *
 * @param targetCurrency Currency to look up.
 * @returns The cached row, or null if nothing is stored for it.
 */
async function getFallbackExchangeRate(targetCurrency: string): Promise<ExchangeRate | null> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', 'EUR')
    .eq('target_currency', targetCurrency)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ExchangeRate;
}

/**
 * Stores a rate, replacing any existing row for the same date and pair.
 *
 * @param date Rate date, `YYYY-MM-DD`.
 * @param targetCurrency Currency the rate converts into.
 * @param rate The rate, quoted as 1 EUR = `rate`.
 * @param isMissing Whether this rate substitutes for a missing one.
 */
async function storeExchangeRate(
  date: string,
  targetCurrency: string,
  rate: number,
  isMissing: boolean,
): Promise<void> {
  const { error } = await supabase.from('exchange_rates').upsert(
    {
      date,
      base_currency: 'EUR',
      target_currency: targetCurrency,
      rate,
      source: isMissing ? 'fallback' : 'api',
      is_missing: isMissing,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'date,base_currency,target_currency', ignoreDuplicates: false },
  );

  if (error) {
    // A failed cache write should not fail the conversion — the rate is still
    // usable, it just costs another API call next time.
    console.warn('Could not cache exchange rate:', error.message);
  }
}

/**
 * Fetches a rate from Frankfurter, with retries and a cached fallback.
 *
 * @param date Rate date, `YYYY-MM-DD`.
 * @param targetCurrency Currency to convert into.
 * @param retries Attempts before falling back.
 * @returns The rate and whether it is a substitute, or null if unobtainable.
 */
async function fetchExchangeRateFromAPI(
  date: string,
  targetCurrency: string,
  retries = DEFAULT_RETRIES,
): Promise<{ rate: number; isMissing: boolean } | null> {
  const url = `${FRANKFURTER_BASE}/${date}?from=EUR&to=${targetCurrency}`;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[targetCurrency];

      if (typeof rate === 'number') {
        return { rate, isMissing: false };
      }
      throw new Error(`No rate for ${targetCurrency} on ${date}`);
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        // Rather than lose the write, substitute the most recent rate we have
        // and mark it, so the caller knows the date is approximate.
        const fallback = await getFallbackExchangeRate(targetCurrency);
        if (fallback) {
          return { rate: fallback.rate, isMissing: true };
        }
        console.warn(`No rate for ${date} ${targetCurrency}:`, error);
        return null;
      }

      // Exponential backoff: 2s, 4s.
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }

  return null;
}

/**
 * The rate for a date and currency, from cache or the API.
 *
 * @param date Rate date, `YYYY-MM-DD`.
 * @param targetCurrency Currency to convert into.
 * @returns The conversion, or null if no rate could be found at all.
 */
async function getExchangeRate(
  date: string,
  targetCurrency: string,
): Promise<ConversionResult | null> {
  if (targetCurrency === 'EUR') {
    return { eurAmount: 1, exchangeRate: 1, rateDate: date, isMissing: false };
  }

  const { data: cached, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('date', date)
    .eq('base_currency', 'EUR')
    .eq('target_currency', targetCurrency)
    .maybeSingle();

  if (!error && cached) {
    return {
      eurAmount: 1,
      exchangeRate: cached.rate,
      rateDate: cached.date,
      isMissing: cached.is_missing ?? false,
    };
  }

  const fromApi = await fetchExchangeRateFromAPI(date, targetCurrency);
  if (!fromApi) return null;

  await storeExchangeRate(date, targetCurrency, fromApi.rate, fromApi.isMissing);

  return {
    eurAmount: 1,
    exchangeRate: fromApi.rate,
    rateDate: date,
    isMissing: fromApi.isMissing,
  };
}

/**
 * Converts an amount to EUR.
 *
 * @param amount The amount in `fromCurrency`.
 * @param fromCurrency The source currency.
 * @param date The transaction date, `YYYY-MM-DD`, used to pick the rate.
 * @returns The euro amount and the rate used, or null if unavailable.
 */
export async function convertToEUR(
  amount: number,
  fromCurrency: string,
  date: string,
): Promise<ConversionResult | null> {
  if (fromCurrency === 'EUR') {
    return { eurAmount: amount, exchangeRate: 1, rateDate: date, isMissing: false };
  }

  const rate = await getExchangeRate(date, fromCurrency);
  if (!rate) return null;

  return {
    // Divide, not multiply — rates are quoted as 1 EUR = X of the source.
    eurAmount: Number((amount / rate.exchangeRate).toFixed(2)),
    exchangeRate: rate.exchangeRate,
    rateDate: rate.rateDate,
    isMissing: rate.isMissing,
  };
}

/**
 * The `YYYY-MM-DD` portion of a transaction's date.
 *
 * The web app passes a full ISO timestamp where the API and the `date` column
 * expect a calendar date; taking the date portion keeps the two apps' cache keys
 * identical for the same transaction.
 *
 * @param isoDate ISO 8601 timestamp or date.
 * @returns The date portion.
 */
export function toRateDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}
