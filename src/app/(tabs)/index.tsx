import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { BalanceChart } from '@/features/balance/balance-chart';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { BalanceCard } from '@/features/funds/balance-card';
import { useFundBalances } from '@/features/funds/use-fund-balances';
import { TX, qk } from '@/lib/query-keys';

/**
 * Home.
 *
 * The chart is anchored to the Balance card's total, so it waits for that total
 * rather than drawing against zero — a chart that briefly shows the wrong line
 * is worse than one that appears a moment late.
 */
export default function HomeScreen() {
  const { data } = useFundBalances();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Everything on this screen: the balances, the chart's series and the 30-day
  // comparison. Invalidating returns once the active queries have refetched, so
  // the spinner stays until the figures are actually new.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        [qk.fundBalances(), [TX, 'anchored'], [TX, 'range']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <BalanceCard />
        {data ? <BalanceChart anchor={data.totalEUR} /> : <View style={styles.chartPlaceholder} />}
        <DashboardSummary />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  chartPlaceholder: {
    height: 288,
  },
});
