/**
 * The years the year selector offers.
 *
 * A fixed range rather than one derived from the data: the web app starts at
 * 2016 and runs five years past today, so future-dated transactions can be
 * entered and reviewed without the selector having to grow.
 */

import { useMemo } from 'react';

import type { StripItem } from '@/components/chip-strip';

/** The earliest year offered, matching the web app. */
const FIRST_YEAR = 2016;

/** How far past today the selector reaches. */
const YEARS_AHEAD = 5;

export type YearOption = StripItem & {
  year: number;
};

/**
 * The selectable years, oldest first.
 *
 * @param today Reference date; defaults to now.
 * @returns Year options with today/future flags.
 */
export function useAvailableYears(currentYear = new Date().getFullYear()): YearOption[] {
  return useMemo(() => {
    const years: YearOption[] = [];

    for (let year = FIRST_YEAR; year <= currentYear + YEARS_AHEAD; year += 1) {
      years.push({
        key: String(year),
        year,
        label: String(year),
        isToday: year === currentYear,
        isFuture: year > currentYear,
      });
    }

    return years;
  }, [currentYear]);
}

/**
 * Index of a year in the list, or -1 if it is out of range.
 *
 * @param years The list to search.
 * @param year The year to find.
 */
export function findYearIndex(years: YearOption[], year: number): number {
  return years.findIndex((option) => option.year === year);
}
