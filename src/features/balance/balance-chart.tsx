import { DashPathEffect, Path as SkiaPath, Circle } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  CartesianChart,
  Line,
  useChartPressState,
  useLinePath,
  type PointsArray,
} from 'victory-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { useBalanceHistory } from '@/features/balance/use-balance-history';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';
import type { TimeRange } from '@/lib/query-keys';

const RANGES: readonly { value: TimeRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
];

const CHART_HEIGHT = 220;

type BalanceChartProps = {
  /** The Balance card's total. The series' last point is set to it. */
  anchor: number;
};

/**
 * Balance over time, anchored to the Balance card.
 *
 * The last point *is* the card's total rather than an independently computed
 * figure that happens to be near it — see `balance-series.ts`. A dashed overlay
 * shows what the balance would look like if split transactions accrued monthly
 * instead of being booked in full on their source date; it is hidden where it
 * does not differ.
 */
export function BalanceChart({ anchor }: BalanceChartProps) {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');

  const { points, isLoading, error } = useBalanceHistory(timeRange, anchor);

  // victory needs a numeric x; the dates are looked up by index when labelling.
  const data = useMemo(
    () => points.map((point, index) => ({ x: index, balance: point.balance, adjusted: point.splitAdjustedBalance })),
    [points],
  );

  const hasOverlay = useMemo(() => points.some((p) => p.splitAdjustedBalance !== null), [points]);

  const { state } = useChartPressState({
    x: 0,
    y: { balance: 0, adjusted: 0 },
  });

  /**
   * Which point the finger is on, mirrored into React state.
   *
   * Read through `useAnimatedReaction` rather than directly in the render body.
   * These are Reanimated shared values living on the UI thread: reading one
   * during render warns, and more importantly yields a frozen snapshot, so the
   * tooltip would never follow the finger. The reaction runs on the UI thread
   * and crosses back with `runOnJS` only when the index actually changes.
   *
   * `matchedIndex` is already the index of the pressed point, so no arithmetic
   * on the x value is needed.
   */
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, previous) => {
      if (index === previous) return;
      runOnJS(setPressedIndex)(index >= 0 ? index : null);
    },
  );

  const pressed =
    pressedIndex !== null && pressedIndex < points.length ? points[pressedIndex] : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <ThemedText themeColor="textSecondary" style={styles.label}>
          BALANCE HISTORY
        </ThemedText>

        <View style={styles.ranges}>
          {RANGES.map((range) => {
            const selected = range.value === timeRange;
            return (
              <Pressable
                key={range.value}
                onPress={() => setTimeRange(range.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.rangeChip,
                  { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                ]}>
                <ThemedText
                  style={[styles.rangeLabel, { color: selected ? theme.text : theme.textSecondary }]}>
                  {range.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.chart}>
        {/* Positioned over the chart rather than above it. As a block in the
            flow it pushed everything down the moment a finger landed, which is
            the one thing a tooltip must not do. */}
        {pressed ? (
          <View style={[styles.tooltip, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary" style={styles.tooltipDate}>
              {formatTooltipDate(pressed.date)}
            </ThemedText>
            <PrivacyValue style={styles.tooltipValue}>
              {formatCurrency(pressed.balance, 'EUR')}
            </PrivacyValue>
            {pressed.income > 0 ? (
              <PrivacyValue style={[styles.tooltipIncome, { color: theme.income }]}>
                {`Income +${formatCurrency(pressed.income, 'EUR')}`}
              </PrivacyValue>
            ) : null}
            {pressed.splitAdjustedBalance !== null ? (
              // One string, not two adjacent expressions: `PrivacyValue`
              // takes a single child, and the figure and unit would otherwise
              // arrive as an array it cannot redact coherently.
              <PrivacyValue themeColor="textSecondary" style={styles.tooltipSplit}>
                {`⑂ ${formatCurrency(pressed.splitAdjustedBalance, 'EUR')}`}
              </PrivacyValue>
            ) : null}
          </View>
        ) : null}

        {isLoading && points.length === 0 ? (
          <ActivityIndicator />
        ) : error ? (
          <ThemedText themeColor="destructive" style={styles.errorText}>
            {messageOf(error)}
          </ThemedText>
        ) : points.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.errorText}>
            No history yet
          </ThemedText>
        ) : (
          <CartesianChart
            data={data}
            xKey="x"
            yKeys={['balance', 'adjusted']}
            chartPressState={state}
            domainPadding={{ top: 12, bottom: 12 }}
            axisOptions={{
              font: null,
              tickCount: { x: 4, y: 4 },
              lineColor: theme.separator,
              labelColor: theme.textSecondary,
              formatYLabel: formatAxisAmount,
              formatXLabel: (value) =>
                formatAxisDate(points[value ?? 0]?.date, timeRange),
            }}>
            {({ points: chartPoints }) => (
              <>
                <Line
                  points={chartPoints.balance}
                  color={theme.tint}
                  strokeWidth={2}
                  curveType="monotoneX"
                />
                {hasOverlay ? (
                  <DashedSeries points={chartPoints.adjusted} color={theme.textSecondary} />
                ) : null}

                {pressedIndex !== null ? (
                  <Circle
                    cx={chartPoints.balance[pressedIndex]?.x ?? 0}
                    cy={chartPoints.balance[pressedIndex]?.y ?? 0}
                    r={4}
                    color={theme.tint}
                  />
                ) : null}
              </>
            )}
          </CartesianChart>
        )}
      </View>
    </View>
  );
}

/**
 * The dotted split-adjusted overlay.
 *
 * Drawn as a Skia path rather than with `<Line>`, because victory's `Line` only
 * exposes a subset of Skia's path props and `strokeDasharray` is not among them.
 * The path is computed by victory's own `useLinePath`, so the dashes follow the
 * same curve as the solid line.
 */
function DashedSeries({ points, color }: { points: PointsArray; color: string }) {
  const { path } = useLinePath(points, { curveType: 'monotoneX' });

  return (
    <SkiaPath path={path} style="stroke" strokeWidth={2} color={color}>
      <DashPathEffect intervals={[5, 4]} />
    </SkiaPath>
  );
}

/**
 * Compact axis figures: 12000 becomes "12k".
 *
 * Accepts null because an axis may be asked to label a tick with no value.
 */
function formatAxisAmount(value: number | null): string {
  if (value === null) return '';

  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absolute >= 10000) return `${sign}${Math.round(absolute / 1000)}k`;
  if (absolute >= 1000) return `${sign}${(absolute / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(absolute)}`;
}

/**
 * X-axis labels, at a granularity that suits the range.
 *
 * A five-year axis showing "12 Sep" would be unreadable, and a one-month axis
 * showing "Sep 2026" would label every point identically.
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
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

/** The tooltip's heading, which shows the full date since the axis does not. */
function formatTooltipDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
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
  tooltip: {
    // Absolute, so it floats over the plot instead of entering the layout.
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    zIndex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    gap: 1,
  },
  tooltipDate: {
    fontSize: 12,
  },
  tooltipValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  tooltipIncome: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tooltipSplit: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  chart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    paddingHorizontal: Spacing.three,
  },
});
