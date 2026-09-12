import { SymbolView } from 'expo-symbols';
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
  const isPositive = day.dailyTotal >= 0;

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
          <SymbolView name="eye.slash" size={12} tintColor={theme.textSecondary} />
        ) : null}
      </View>

      <View style={[styles.side, styles.totals]}>
        <PrivacyValue
          style={[styles.dayTotal, { color: isPositive ? theme.income : theme.expense }]}
          numberOfLines={1}>
          {formatCurrency(Math.abs(day.dailyTotal), 'EUR')}
        </PrivacyValue>

        {day.dailySplitTotal !== 0 ? (
          <View style={styles.splitTotal}>
            <SymbolView name="arrow.triangle.branch" size={11} tintColor={theme.textSecondary} />
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
    paddingVertical: Spacing.two,
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
    fontSize: 13,
    fontWeight: '600',
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  splitTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  daySplit: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
