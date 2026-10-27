import { SymbolView } from 'expo-symbols';
import { EyeOff } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { formatDateHeader, formatDateHeaderWithYear } from '@/domain/date';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import type { DayGroup } from '@/features/transactions/group-by-day';
import { useTheme } from '@/hooks/use-theme';

type DayHeaderProps = {
  day: DayGroup;
  /**
   * Whether to include the year in the date.
   *
   * Search results span every year the user has data for, so a bare "Monday,
   * August 2" would be ambiguous there. Month and year views already fix the
   * period in the strip above, so they leave it off.
   */
  showYear?: boolean;
};

/**
 * A sticky day header: the date on the left, the day's totals on the right.
 *
 * Shared by the month view and search results so the two cannot drift apart.
 *
 * Both totals are always covered by privacy mode — unlike a transaction row,
 * where only income is hidden. A day total is an aggregate, so leaving it
 * readable would leak the sum of the very values being hidden.
 */
export const DayHeader = memo(function DayHeader({ day, showYear = false }: DayHeaderProps) {
  const theme = useTheme();
  const totalColor =
    day.dailyTotal === 0
      ? theme.textSecondary
      : day.dailyTotal > 0
        ? theme.income
        : theme.expense;

  return (
    <View
      style={[
        styles.dayHeader,
        { backgroundColor: theme.background, borderBottomColor: theme.separator },
      ]}>
      <View style={styles.side}>
        <ThemedText themeColor="textSecondary" style={styles.dayLabel}>
          {showYear ? formatDateHeaderWithYear(day.isoDate) : formatDateHeader(day.isoDate)}
        </ThemedText>
        {day.hiddenCount > 0 ? (
          <EyeOff size={12} color={theme.textSecondary} strokeWidth={2} />
        ) : null}
      </View>

      <View style={[styles.side, styles.totals]}>
        <PrivacyValue
          style={[styles.dayTotal, { color: totalColor }]}
          numberOfLines={1}>
          {`${day.dailyTotal > 0 ? '+' : ''}${formatCurrency(Math.abs(day.dailyTotal), 'EUR')}`}
        </PrivacyValue>

        {day.dailySplitTotal !== 0 ? (
          <View
            style={[styles.splitChip, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView
              name="arrow.triangle.branch"
              size={11}
              tintColor={theme.textSecondary}
            />
            <ThemedText themeColor="textSecondary" style={styles.splitChipLabel}>
              Split ·
            </ThemedText>
            <PrivacyValue themeColor="textSecondary" style={styles.daySplit} numberOfLines={1}>
              {formatCurrency(Math.abs(day.dailySplitTotal), 'EUR')}
            </PrivacyValue>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  totals: {
    flexShrink: 1,
  },
  dayLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  dayTotal: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  splitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: Spacing.half,
    borderRadius: 99,
  },
  splitChipLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
  daySplit: {
    fontSize: 12,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
});
