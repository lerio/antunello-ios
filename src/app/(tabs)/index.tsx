import { ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { BalanceChart } from '@/features/balance/balance-chart';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { BalanceCard } from '@/features/funds/balance-card';
import { useFundBalances } from '@/features/funds/use-fund-balances';

/**
 * Home.
 *
 * The chart is anchored to the Balance card's total, so it waits for that total
 * rather than drawing against zero — a chart that briefly shows the wrong line
 * is worse than one that appears a moment late.
 */
export default function HomeScreen() {
  const { data } = useFundBalances();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
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
