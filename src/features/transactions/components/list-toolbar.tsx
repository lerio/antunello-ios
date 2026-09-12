import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { SearchField } from '@/features/search/components/search-field';
import { useTheme } from '@/hooks/use-theme';

/**
 * The search field and filter button above the transaction list.
 *
 * Shared by the month and year views so the two cannot drift apart — the web app
 * offers both entry points from both pages, and a missing one here would not be
 * noticed until someone went looking for it.
 */
export function ListToolbar() {
  const theme = useTheme();
  const router = useRouter();

  return (
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
  );
}

const styles = StyleSheet.create({
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
