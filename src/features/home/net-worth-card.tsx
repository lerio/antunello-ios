import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card, CardToggle } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { BalanceChart } from '@/features/balance/balance-chart';
import { useFundBalances } from '@/features/funds/use-fund-balances';
import { PrivacyValue } from '@/features/privacy/privacy-value';
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
  const router = useRouter();
  const { data, isLoading, error } = useFundBalances();
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText
            accessibilityRole="header"
            themeColor="text"
            style={styles.sectionLabel}>
            Net worth
          </ThemedText>

          {isLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <PrivacyValue style={styles.total}>
                {formatCurrency(data?.totalEUR ?? 0, 'EUR')}
              </PrivacyValue>
              <View style={styles.asOfRow}>
                <ThemedText themeColor="textSecondary" style={styles.asOf}>
                  {`as of ${todayLabel()}`}
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/funds')}
                  hitSlop={8}
                  accessibilityRole="link"
                  accessibilityLabel="Check funds">
                  <ThemedText themeColor="tint" style={styles.checkFunds}>
                    Check funds
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <CardToggle
          open={chartOpen}
          onPress={() => setChartOpen((open) => !open)}
          openLabel="Hide chart"
          closedLabel="Show chart"
        />
      </View>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.errorText}>
          {messageOf(error)}
        </ThemedText>
      ) : null}

      {chartOpen && data ? <BalanceChart anchor={data.totalEUR} embedded /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionLabel: {
    fontSize: 18,                 // matches web text-lg (18px)
    fontWeight: '600',
  },
  total: {
    fontSize: 30,                 // matches web text-3xl (30px)
    lineHeight: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  asOfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  asOf: {
    fontSize: 12,
  },
  checkFunds: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 13,
    paddingHorizontal: 0,         // padding now on card
    paddingBottom: Spacing.two,
  },
});
