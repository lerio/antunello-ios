import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type OutlineButtonProps = {
  label: string;
  onPress: () => void;
  symbol?: SymbolViewProps['name'];
};

/**
 * A bordered button for a list's "Add …" action: web's `Button variant="outline"`
 * (Add New Budget, Add New Fund Category, Add New Category).
 */
export function OutlineButton({ label, onPress, symbol = 'plus' }: OutlineButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.card, borderColor: theme.separator, opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name={symbol} size={14} tintColor={theme.text} />
      <ThemedText style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 40,
    borderRadius: Radius.small + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
