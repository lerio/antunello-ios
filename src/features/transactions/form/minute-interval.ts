/** The web app offers times on a 15-minute grid, so the app does too. */
export const MINUTE_INTERVAL = 15;

/**
 * Rounds a time to the nearest 15 minutes.
 *
 * Applied in the model rather than left to the picker. iOS honours
 * `minuteInterval` for the spinner, but a value arriving from elsewhere — an
 * imported bank transaction stamped 14:07 — would otherwise be editable and
 * re-saved at a time the picker itself cannot express.
 *
 * @param date The date to round.
 * @returns A copy on the nearest 15-minute boundary.
 */
export function roundToMinuteInterval(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(Math.round(minutes / MINUTE_INTERVAL) * MINUTE_INTERVAL, 0, 0);
  return rounded;
}
