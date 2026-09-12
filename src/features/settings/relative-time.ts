/**
 * Sync times as short relative phrases.
 *
 * Shared by the bank row and its per-account controls, which show the same kind
 * of timestamp one above the other — two implementations would eventually
 * disagree and read as two different facts.
 *
 * The web app shows nothing here at all. A timestamp is worth the space on a
 * phone because it is the only way to tell a working connection from one that
 * quietly stopped syncing weeks ago.
 */

/**
 * Formats a sync time relative to now.
 *
 * @param iso An ISO timestamp.
 * @param now Reference time, so the output is testable.
 * @returns A phrase like `just now`, `20 minutes ago`, `3 days ago`, or a date
 *          once it is old enough for a date to be more useful.
 */
export function formatSync(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';

  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
