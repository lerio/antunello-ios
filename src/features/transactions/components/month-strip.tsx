import { useMemo } from 'react';

import { ChipStrip, type StripItem } from '@/components/chip-strip';
import type { MonthOption } from '@/features/transactions/use-available-months';

type MonthStripProps = {
  months: MonthOption[];
  /** Index of the selected month within `months`, or -1 if it is not listed. */
  selectedIndex: number;
  onSelect: (month: MonthOption) => void;
};

/**
 * The month selector.
 *
 * A thin adapter over `ChipStrip`, which owns the scrolling and centring. This
 * exists only to translate months into chips and report the chosen one back as a
 * month rather than an index.
 */
export function MonthStrip({ months, selectedIndex, onSelect }: MonthStripProps) {
  const items = useMemo<StripItem[]>(
    () =>
      months.map((month) => ({
        key: `${month.year}-${month.month}`,
        label: month.shortLabel,
        isToday: month.isToday,
        isFuture: month.isFuture,
      })),
    [months],
  );

  return (
    <ChipStrip
      items={items}
      selectedIndex={selectedIndex}
      accessibilityLabel="Month"
      onSelect={(index) => {
        const month = months[index];
        if (month) onSelect(month);
      }}
    />
  );
}
