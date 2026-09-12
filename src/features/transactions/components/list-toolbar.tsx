import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { PendingBanner } from '@/features/pending/components/pending-banner';
import { SearchField } from '@/features/search/components/search-field';
import { useTheme } from '@/hooks/use-theme';

/**
 * The search field, filter button and pending-bank prompt above the list.
 *
 * Shared by the month and year views so the two cannot drift apart — the web app
 * offers the search and filter entry points from both pages, and a missing one
 * here would not be noticed until someone went looking for it.
 *
 * The pending prompt rides along rather than sitting in the month view alone,
 * because the badge that leads here is on the tab: someone who taps Transactions
 * and lands on the year view should still find what the badge was about.
 */
export function ListToolbar() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.field}>
          <SearchField onPress={() => router.push('/transactions/search')} />
        </View>

        <Pressable
          onPress={() => router.push('/transactions/filter')}
          accessibilityRole="button"
          accessibilityLabel="Filter transactions"
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <SymbolView name="line.3.horizontal.decrease" size={18} tintColor={theme.tint} />
        </Pressable>
      </View>

      <PendingBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
