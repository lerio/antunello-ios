/**
 * The months offered by the month selector.
 *
 * Ported from the web app's `useAvailableMonths`, including its window: from the
 * earliest transaction (or two years back, before that loads) through twelve
 * months into the future.
 *
 * The labels are built from static month names rather than
 * `toLocaleDateString`, which is where this differs from the web app. The output
 * is identical for `en-US`, but it removes a dependency on the engine's ICU
 * data for strings the user reads on every screen — and the vendored
 * `formatDate` already depends on ICU for the grouping key, so this keeps the
 * blast radius of an ICU difference smaller rather than larger.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-keys';

export type MonthOption = {
  year: number;
  /** 1-12. */
  month: number;
  /** First day of the month, for comparisons. */
  date: Date;
  /** e.g. "September", or "September 2025" outside the current year. */
  label: string;
  /** e.g. "Sep", or "Sep 25" outside the current year. */
  shortLabel: string;
  isToday: boolean;
  isFuture: boolean;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** How far back the selector reaches before the earliest transaction loads. */
const FALLBACK_YEARS_BACK = 2;
/** How far forward it reaches, which allows scheduling future transactions. */
const MONTHS_FORWARD = 12;

/**
 * Fetches the date of the earliest transaction, or null if there are none.
 *
 * Cached indefinitely: the earliest transaction only changes if an older one is
 * created, which is rare enough that a stale selector is not worth refetching on
 * every mount.
 */
function useFirstTransactionDate() {
  return useQuery({
    queryKey: qk.firstTransactionDate(),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.date ?? null;
    },
    staleTime: Infinity,
  });
}

/**
 * Builds the list of selectable months, oldest first.
 *
 * @param firstTransactionDate ISO date of the earliest transaction, if known.
 * @returns Month options with labels and today/future flags.
 */
function buildMonths(firstTransactionDate: string | null): MonthOption[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);

  // Start at the earliest transaction, or a fixed window while that loads.
  const first = firstTransactionDate ? new Date(firstTransactionDate) : null;
  const start =
    first && !Number.isNaN(first.getTime())
      ? new Date(first.getFullYear(), first.getMonth(), 1)
      : new Date(currentYear - FALLBACK_YEARS_BACK, 0, 1);

  const end = new Date(currentYear, currentMonth - 1 + MONTHS_FORWARD, 1);

  const months: MonthOption[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const sameYear = year === currentYear;

    months.push({
      year,
      month,
      date: new Date(year, cursor.getMonth(), 1),
      label: sameYear ? MONTH_NAMES[month - 1] : `${MONTH_NAMES[month - 1]} ${year}`,
      shortLabel: sameYear ? MONTH_SHORT[month - 1] : `${MONTH_SHORT[month - 1]} ${String(year).slice(-2)}`,
      isToday: year === currentYear && month === currentMonth,
      isFuture: cursor > startOfCurrentMonth,
    });
  }

  return months;
}

/**
 * The months to show in the month selector.
 *
 * @returns Month options, plus whether the underlying query is still loading.
 */
export function useAvailableMonths() {
  const { data, isLoading } = useFirstTransactionDate();

  const months = useMemo(() => buildMonths(data ?? null), [data]);

  return { months, isLoading };
}

/**
 * Index of a year/month pair within a month list, or -1 if absent.
 *
 * @param months The list to search.
 * @param year Target year.
 * @param month Target month, 1-12.
 * @returns The index, or -1.
 */
export function findMonthIndex(months: MonthOption[], year: number, month: number): number {
  return months.findIndex((m) => m.year === year && m.month === month);
}
