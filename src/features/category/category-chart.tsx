import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import type { CategoryDataPoint } from '@/features/category/category-history';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import type { TimeRange } from '@/lib/query-keys';

const RANGES: readonly { value: TimeRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
];

const CHART_HEIGHT = 180;

type CategoryChartProps = {
  dataPoints: CategoryDataPoint[];
  totalAmount: number;
  totalTransactions: number;
  timeRange: TimeRange;
  onSelectRange: (range: TimeRange) => void;
  isLoading: boolean;
};

/**
 * Spending for one category, as a bar per bucket.
 *
 * Empty buckets are drawn as gaps rather than skipped — the pre-seeded grid in
 * `category-history.ts` guarantees they exist, and a quiet month is information
 * worth seeing.
 */
export function CategoryChart({
  dataPoints,
  totalAmount,
  totalTransactions,
  timeRange,
  onSelectRange,
  isLoading,
}: CategoryChartProps) {
  const theme = useTheme();

  // victory needs a numeric x; the dates are looked up by index when labelling.
  const data = useMemo(
    () => dataPoints.map((point, index) => ({ x: index, amount: point.amount })),
    [dataPoints],
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <View style={styles.totals}>
          <PrivacyValue style={styles.total}>{formatCurrency(totalAmount, 'EUR')}</PrivacyValue>
          <ThemedText themeColor="textSecondary" style={styles.count}>
            {totalTransactions} {totalTransactions === 1 ? 'transaction' : 'transactions'}
          </ThemedText>
        </View>

        <View style={styles.ranges}>
          {RANGES.map((range) => {
            const selected = range.value === timeRange;
            return (
              <Pressable
                key={range.value}
                onPress={() => onSelectRange(range.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.rangeChip,
                  { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                ]}>
                <ThemedText
                  style={[
                    styles.rangeLabel,
                    { color: selected ? theme.text : theme.textSecondary },
                  ]}>
                  {range.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.chart}>
        {isLoading ? (
          <ActivityIndicator />
        ) : dataPoints.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing in this range
          </ThemedText>
        ) : (
          <CartesianChart
            data={data}
            xKey="x"
            yKeys={['amount']}
            domainPadding={{ top: 12 }}
            axisOptions={{
              font: null,
              tickCount: { x: 4, y: 4 },
              lineColor: theme.separator,
              labelColor: theme.textSecondary,
              formatYLabel: formatAxisAmount,
              formatXLabel: (value) => formatAxisDate(dataPoints[value ?? 0]?.date, timeRange),
            }}>
            {({ points, chartBounds }) => (
              <Bar
                points={points.amount}
                chartBounds={chartBounds}
                color={theme.tint}
                roundedCorners={{ topLeft: 2, topRight: 2 }}
              />
            )}
          </CartesianChart>
        )}
      </View>
    </View>
  );
}

/** Compact axis figures: 1200 becomes "1.2k". */
function formatAxisAmount(value: number | null): string {
  if (value === null) return '';
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

/**
 * X-axis labels, at a granularity that suits the range.
 *
 * A range of years labelled by day would print every bar identically, and a
 * range of days labelled by year would do the same.
 */
function formatAxisDate(isoDate: string | undefined, timeRange: TimeRange): string {
  if (!isoDate) return '';

  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (timeRange === '1m') {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  if (timeRange === '1y') {
    return date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  totals: {
    gap: Spacing.half,
  },
  total: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  count: {
    fontSize: 12,
  },
  ranges: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  rangeChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
  },
  rangeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    fontSize: 13,
  },
});
