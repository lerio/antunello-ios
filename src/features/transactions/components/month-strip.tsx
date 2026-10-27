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
 *
 * A year marker occupies a slot wherever the year changes, so every chip can
 * stay three letters rather than growing a second line at each January.
 */
export function MonthStrip({ months, selectedIndex, onSelect }: MonthStripProps) {
  const { items, itemMonths } = useMemo(() => {
    const stripItems: StripItem[] = [];
    const monthsByItem: (MonthOption | null)[] = [];

    months.forEach((month, index) => {
      if (index > 0 && months[index - 1].year !== month.year) {
        stripItems.push({
          key: `year-${month.year}`,
          label: String(month.year),
          isToday: false,
          isFuture: false,
          isMarker: true,
        });
        monthsByItem.push(null);
      }

      stripItems.push({
        key: `${month.year}-${month.month}`,
        label: month.shortLabel,
        accessibilityLabel: month.label.includes(String(month.year))
          ? month.label
          : `${month.label} ${month.year}`,
        isToday: month.isToday,
        isFuture: month.isFuture,
      });
      monthsByItem.push(month);
    });

    return { items: stripItems, itemMonths: monthsByItem };
  }, [months]);

  const selectedItemIndex = useMemo(() => {
    const selected = months[selectedIndex];
    if (!selected) return -1;
    return items.findIndex((item) => item.key === `${selected.year}-${selected.month}`);
  }, [items, months, selectedIndex]);

  return (
    <ChipStrip
      items={items}
      selectedIndex={selectedItemIndex}
      accessibilityLabel="Month"
      onSelect={(index) => {
        const month = itemMonths[index];
        if (month) onSelect(month);
      }}
    />
  );
}
