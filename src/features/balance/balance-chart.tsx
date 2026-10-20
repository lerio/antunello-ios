import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import {
  Circle,
  LinearGradient,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { niceTicks, xTickIndices } from '@/features/balance/chart-ticks';
import { useBalanceHistory } from '@/features/balance/use-balance-history';
import { usePrivacy } from '@/features/privacy/privacy-provider';
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

/** Spoken range names; the pills themselves are abbreviated. */
const RANGE_ACCESSIBILITY: Record<TimeRange, string> = {
  '1m': 'one month',
  '1y': 'one year',
  '5y': 'five years',
  all: 'all time',
};

const CHART_HEIGHT = 220;

type BalanceChartProps = {
  /** The Balance card's total. The series' last point is set to it. */
  anchor: number;
  /** Render without the card chrome and title, for use inside another card. */
  embedded?: boolean;
};

/**
 * Balance over time, anchored to the Balance card.
 *
 * The last point *is* the card's total rather than an independently computed
 * figure that happens to be near it — see `balance-series.ts`. One line, no
 * overlay: the series is a single running balance.
 */
export function BalanceChart({ anchor, embedded = false }: BalanceChartProps) {
  const theme = useTheme();
  const { enabled: privacyEnabled } = usePrivacy();
  const [timeRange, setTimeRange] = useState<TimeRange>('1y');

  const { points, isLoading, error } = useBalanceHistory(timeRange, anchor);

  // victory needs a numeric x; the dates are looked up by index when labelling.
  const data = useMemo(
    () => points.map((point, index) => ({ x: index, balance: point.balance })),
    [points],
  );

  const xTicks = useMemo(
    () => xTickIndices(points.map((point) => point.date), timeRange),
    [points, timeRange],
  );
  const yTicks = useMemo(() => {
    if (points.length === 0) return [];
    const balances = points.map((point) => point.balance);
    return niceTicks(Math.min(...balances), Math.max(...balances));
  }, [points]);
  const yDomain: [number, number] | undefined =
    yTicks.length > 1 ? [yTicks[0], yTicks[yTicks.length - 1]] : undefined;

  // Skia needs a real font to draw the axis labels; `font: null` hides them.
  const axisFont = useMemo(
    () => matchFont({ fontFamily: 'Helvetica', fontSize: 11 }),
    [],
  );

  const { state } = useChartPressState({
    x: 0,
    y: { balance: 0 },
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

  const handlePressedIndex = useCallback((index: number) => {
    setPressedIndex(index >= 0 ? index : null);
    if (index >= 0) {
      // One tick per point, the same feedback as a picker wheel. Haptics are
      // decoration, so a device that cannot play them must not break scrubbing.
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, previous) => {
      if (index === previous) return;
      runOnJS(handlePressedIndex)(index);
    },
  );

  const pressed =
    pressedIndex !== null && pressedIndex < points.length ? points[pressedIndex] : null;

  const chartAccessibilityLabel = privacyEnabled
    ? 'Chart hidden'
    : error
      ? `Could not load the chart. ${messageOf(error)}`
      : points.length === 0
        ? 'No history yet'
        : `Net worth chart, ${RANGE_ACCESSIBILITY[timeRange]}. Latest ${formatCurrency(
            points[points.length - 1].balance,
            'EUR',
          )}`;

  return (
    <View style={embedded ? styles.embedded : [styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        {embedded ? null : (
          <ThemedText themeColor="textSecondary" style={styles.label}>
            BALANCE HISTORY
          </ThemedText>
        )}

        <Host style={styles.rangeHost} seedColor={theme.tint}>
          <Picker
            label="Chart range"
            selection={timeRange}
            onSelectionChange={(value) => setTimeRange(value)}
            modifiers={[pickerStyle('segmented')]}>
            {RANGES.map((range) => (
              <SwiftText key={range.value} modifiers={[tag(range.value)]}>
                {range.label}
              </SwiftText>
            ))}
          </Picker>
        </Host>
      </View>

      <View
        style={styles.chart}
        accessible
        accessibilityLabel={chartAccessibilityLabel}>
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
        ) : privacyEnabled ? (
          // React Native's `filter: blur` does nothing on iOS, so the chart is
          // replaced by a same-height block. Hiding it outright would reflow
          // the card; a blank block keeps the layout and reveals nothing.
          <View
            style={[
              styles.chart,
              styles.hiddenChart,
              { backgroundColor: theme.backgroundElement },
            ]}
          />
        ) : (
          <CartesianChart
            data={data}
            xKey="x"
            yKeys={['balance']}
            chartPressState={state}
            domain={yDomain ? { y: yDomain } : undefined}
            padding={{ top: 8, right: 8, bottom: 24, left: 40 }}
            domainPadding={{ top: 12, bottom: 12 }}
            axisOptions={{
              font: axisFont,
              tickValues: { x: xTicks, y: yTicks },
              lineColor: { grid: { x: 'transparent', y: theme.separator }, frame: 'transparent' },
              lineWidth: { grid: { x: 0, y: 1 }, frame: 0 },
              labelColor: theme.textSecondary,
              formatYLabel: formatAxisAmount,
              formatXLabel: (value) =>
                formatAxisDate(points[value ?? 0]?.date, timeRange),
            }}>
            {({ points: chartPoints, chartBounds }) => (
              <>
                <Area
                  points={chartPoints.balance}
                  y0={chartBounds.bottom}
                  curveType="monotoneX">
                  <LinearGradient
                    start={vec(0, chartBounds.top)}
                    end={vec(0, chartBounds.bottom)}
                    colors={[`${theme.tint}14`, `${theme.tint}00`]}
                  />
                </Area>
                <Line
                  points={chartPoints.balance}
                  color={theme.tint}
                  strokeWidth={2}
                  curveType="monotoneX"
                />
                {pressedIndex === null ? (
                  <Circle
                    cx={chartPoints.balance[chartPoints.balance.length - 1]?.x ?? 0}
                    cy={chartPoints.balance[chartPoints.balance.length - 1]?.y ?? 0}
                    r={4}
                    color={theme.tint}
                  />
                ) : (
                  <Circle
                    cx={chartPoints.balance[pressedIndex]?.x ?? 0}
                    cy={chartPoints.balance[pressedIndex]?.y ?? 0}
                    r={4}
                    color={theme.tint}
                  />
                )}
              </>
            )}
          </CartesianChart>
        )}
      </View>
    </View>
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
  return date.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'UTC' });
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
    borderRadius: Radius.large,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  embedded: {
    paddingTop: Spacing.two,
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
  rangeHost: {
    flex: 1,
    height: 34,
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
  chart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
  },
  hiddenChart: {
    marginHorizontal: Spacing.three,
    borderRadius: Radius.small,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    paddingHorizontal: Spacing.three,
  },
});
