/**
 * Axis tick selection for the balance chart.
 *
 * Kept pure so the two rules that make an axis readable — rounded y values and
 * one label per month/year — can be tested without a chart.
 */

import type { TimeRange } from '@/lib/query-keys';

/**
 * Rounded y-axis values, so the axis reads 95k/100k/105k rather than 98.4k.
 *
 * @param min Lowest plotted value.
 * @param max Highest plotted value.
 * @param count Number of gaps wanted; the result has up to `count + 1` ticks.
 */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  let step =
    (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10) *
    magnitude;

  // Rounding out to whole steps can add an extra tick at each end. Widen the
  // step until the axis has at most `count + 1` lines.
  for (;;) {
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let value = start; value <= end + step / 2; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }
    if (ticks.length <= count + 1) return ticks;
    step *= 2;
  }
}

/**
 * Indices to label on the x-axis: weekly points for a month, then the first
 * point of each month, or each year beyond a year.
 *
 * The phone is narrow, so months are thinned to every second one and long
 * histories to at most six labels.
 */
export function xTickIndices(
  dates: readonly string[],
  timeRange: TimeRange,
): number[] {
  if (dates.length === 0) return [];

  if (timeRange === '1m') {
    return dates.map((_, index) => index).filter((index) => index % 7 === 0);
  }

  const keyLength = timeRange === '1y' ? 7 : 4;
  const ticks: number[] = [];
  let previous = '';

  dates.forEach((date, index) => {
    const key = date.slice(0, keyLength);
    if (key !== previous) {
      ticks.push(index);
      previous = key;
    }
  });

  const step = timeRange === '1y' ? 2 : Math.ceil(ticks.length / 6);
  return step > 1 ? ticks.filter((_, index) => index % step === 0) : ticks;
}
