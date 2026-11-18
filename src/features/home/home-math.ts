/**
 * Pure arithmetic behind the At a glance card.
 *
 * Kept out of the component so the rules that decide the headline, the colour
 * and the culprits can be tested without React or Supabase.
 */

type PaceMood = 'over' | 'under' | 'inline' | 'unknown';

/** Percentage above or below the typical figure, or null without a baseline. */
export function percentageOverTypical(
  spent: number,
  typical: number | null,
): number | null {
  return typical !== null && typical > 0 ? ((spent - typical) / typical) * 100 : null;
}

/**
 * Which way the month is running.
 *
 * Half a percent is "in line": the card rounds to whole percentages, so
 * anything smaller would print "0% over".
 */
export function moodOf(percent: number | null): PaceMood {
  if (percent === null) return 'unknown';
  if (percent > 0.5) return 'over';
  if (percent < -0.5) return 'under';
  return 'inline';
}

/**
 * Group movers by main category, sum their deltas, then pick the five biggest.
 */
export function culpritsOf<T extends { mainCategory: string; delta: number; spentToDate: number; typicalToDate: number }>(
  movers: readonly T[],
  limit = 5,
): Array<{ mainCategory: string; delta: number; spentToDate: number; typicalToDate: number }> {
  const byMain = new Map<string, { mainCategory: string; spentToDate: number; typicalToDate: number; delta: number }>();
  for (const m of movers) {
    const existing = byMain.get(m.mainCategory);
    if (existing) {
      existing.spentToDate += m.spentToDate;
      existing.typicalToDate += m.typicalToDate;
      existing.delta += m.delta;
    } else {
      byMain.set(m.mainCategory, { mainCategory: m.mainCategory, spentToDate: m.spentToDate, typicalToDate: m.typicalToDate, delta: m.delta });
    }
  }
  return [...byMain.values()]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

/**
 * The window the previous-month comparison covers, e.g. `Sep 1–19`.
 *
 * The day is clamped to the previous month's length: on 31 October the
 * comparison only runs to 30 September, and saying "day 31" would claim a
 * window that does not exist.
 */
export function previousMonthWindow(monthStart: string, asOfDate: string): string {
  const [year, month] = monthStart.split('-').map(Number);
  const daysInPreviousMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const day = Math.min(Number(asOfDate.slice(8, 10)), daysInPreviousMonth);
  // en-GB renders September as "Sept"; the shared copy deck wants three letters.
  const name = new Date(Date.UTC(year, month - 2, 1))
    .toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    .slice(0, 3);

  return `${name} 1–${day}`;
}
