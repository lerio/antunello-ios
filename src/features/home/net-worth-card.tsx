import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { BalanceChart } from '@/features/balance/balance-chart';
import { useFundBalances } from '@/features/funds/use-fund-balances';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';

/** Today as `20 Oct`, the same shape the web app uses. */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Everything the user owns, how it moved this month, and the date the figure is
 * stated for — with the trend beside it.
 *
 * The chart is anchored to the fund total, so its last point *is* the number
 * printed above it.
 */
export function NetWorthCard() {
  const theme = useTheme();
  const { data, isLoading, error } = useFundBalances();
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.separator,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText
            accessibilityRole="header"
            themeColor="textSecondary"
            style={styles.sectionLabel}>
            NET WORTH
          </ThemedText>

          {isLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <PrivacyValue style={styles.total}>
                {formatCurrency(data?.totalEUR ?? 0, 'EUR')}
              </PrivacyValue>
              <ThemedText themeColor="textSecondary" style={styles.asOf}>
                {`as of ${todayLabel()}`}
              </ThemedText>
            </>
          )}
        </View>

        <Pressable
          onPress={() => setChartOpen((open) => !open)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded: chartOpen }}
          accessibilityLabel={chartOpen ? 'Hide chart' : 'Show chart'}
          style={styles.toggle}>
          <SymbolView
            name={chartOpen ? 'chevron.up' : 'chevron.down'}
            size={13}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      </View>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.errorText}>
          {messageOf(error)}
        </ThemedText>
      ) : null}

      {chartOpen && data ? <BalanceChart anchor={data.totalEUR} embedded /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  toggle: {
    padding: Spacing.two,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 32,
    // Explicit: ThemedText's default lineHeight is 24 and would clip the glyphs.
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  asOf: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
