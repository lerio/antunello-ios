import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A search field that is not an input.
 *
 * Tapping it pushes the search screen, where the real field focuses. The
 * alternative — an editable field on the list itself — would mean either
 * searching in place, which competes with the month strip for what the list is
 * showing, or a field that looks editable and then navigates, which is worse.
 */
export function SearchField({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search transactions"
      style={({ pressed }) => [
        styles.field,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name="magnifyingglass" size={15} tintColor={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.placeholder}>
        Search transactions
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    height: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small + 2,
  },
  placeholder: {
    fontSize: 17,
  },
});
