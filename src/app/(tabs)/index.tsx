import { ScrollView, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { BalanceCard } from '@/features/funds/balance-card';

/**
 * Home.
 *
 * Currently the Balance card only. The anchored balance chart and the 30-day
 * comparison tables land next.
 */
export default function HomeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BalanceCard />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
