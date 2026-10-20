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
 * Up to three categories explaining the gap, in the direction it runs.
 *
 * Expects movers ordered by delta descending, which is what the RPC returns.
 */
export function culpritsOf<T extends { delta: number }>(
  movers: readonly T[],
  mood: PaceMood,
  limit = 3,
): T[] {
  if (mood === 'over') return movers.filter((mover) => mover.delta > 0).slice(0, limit);
  if (mood === 'under') {
    return movers
      .filter((mover) => mover.delta < 0)
      .slice(-limit)
      .reverse();
  }
  return [];
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
