/**
 * The three comparison windows the dashboard reports over.
 *
 * Ported from the web app's `comparison-windows`. All three are 30-day spans:
 * the current window, the 30 days immediately before it, and the same 30 days
 * one year earlier.
 *
 * The windows are contiguous by construction — `prev` ends the day before
 * `current` begins — so the two adjacent periods have no gap and no overlap, and
 * the comparison is like for like.
 */

export type Window = { start: string; end: string };

export type ComparisonWindows = {
  current: Window;
  prev: Window;
  lastYear: Window;
};

/** `YYYY-MM-DD` in UTC. */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * The current, previous and year-earlier 30-day windows.
 *
 * @param today The reference date; defaults to now.
 * @returns The three windows, as inclusive `YYYY-MM-DD` ranges.
 */
export function getComparisonWindows30(today: Date = new Date()): ComparisonWindows {
  const currentEnd = today;
  // 29 days back plus today makes 30 days inclusive.
  const currentStart = subDays(today, 29);

  const prevEnd = subDays(currentStart, 1);
  const prevStart = subDays(prevEnd, 29);

  const lastYearEnd = new Date(currentEnd);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);
  const lastYearStart = new Date(currentStart);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);

  return {
    current: { start: formatDate(currentStart), end: formatDate(currentEnd) },
    prev: { start: formatDate(prevStart), end: formatDate(prevEnd) },
    lastYear: { start: formatDate(lastYearStart), end: formatDate(lastYearEnd) },
  };
}
