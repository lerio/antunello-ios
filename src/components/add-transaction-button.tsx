import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The floating add button.
 *
 * Clears the tab bar and the home indicator, so it never sits under a gesture
 * target. Shared by the month view and search results — the web app offers it on
 * both, and two copies would drift in exactly the sort of way nobody notices
 * until one of them is wrong.
 */
export function AddTransactionButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.tint,
          bottom: BottomTabInset + insets.bottom + Spacing.three,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <SymbolView name="plus" size={24} tintColor="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
