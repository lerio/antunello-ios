/**
 * Detecting changes made on another device.
 *
 * Ported from the web app's `BackgroundSyncProvider`. There is no Realtime
 * subscription (see CLAUDE.md), so the app asks a cheap question every few
 * seconds — how many transactions are there, and when was one last touched — and
 * compares the answer with the previous one. The pure comparison lives here so
 * it can be tested; the polling is in `use-remote-changes.ts`.
 */

/** What one poll learned: the row count and the newest `updated_at`. */
export type RemoteVersion = {
  count: number;
  lastUpdate: string;
};

export type RemoteChange = {
  /** How many transactions were added or removed; 0 when rows were only edited. */
  delta: number;
};

/** How often to check, while the app is in the foreground. */
export const POLL_INTERVAL_MS = 15_000;

/**
 * Compares a poll against the previous one.
 *
 * @param baseline The previous poll, or null before the first.
 * @param current The poll just made.
 * @returns The baseline to keep, and the change if there was one. The first poll
 *   only establishes a baseline — there is nothing yet to have changed from.
 */
export function detectRemoteChange(
  baseline: RemoteVersion | null,
  current: RemoteVersion,
): { next: RemoteVersion; change: RemoteChange | null } {
  if (!baseline) return { next: current, change: null };

  if (current.count === baseline.count && current.lastUpdate === baseline.lastUpdate) {
    return { next: baseline, change: null };
  }

  return { next: current, change: { delta: Math.abs(current.count - baseline.count) } };
}

/** The banner's wording, as on the web app. */
export function describeRemoteChange(change: RemoteChange): string {
  if (change.delta === 0) return 'Transactions updated on another device';
  return `${change.delta} new ${change.delta === 1 ? 'transaction' : 'transactions'} available`;
}

/**
 * Counts this device's own writes.
 *
 * Every write moves the row count or `updated_at`, which would otherwise be
 * reported as a remote change. The poller notes the count when it takes its
 * baseline and, if it has moved by the next poll, re-baselines silently — the
 * equivalent of the web app's `recordLocalMutation`.
 */
let localWrites = 0;

export function markLocalWrite(): void {
  localWrites += 1;
}

export function getLocalWriteCount(): number {
  return localWrites;
}
