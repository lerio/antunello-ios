import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type ViewTabsProps = {
  value: 'month' | 'year';
  onChange: (value: 'month' | 'year') => void;
};

const OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

/**
 * The Month / Year switch.
 *
 * Matches the web app's TransactionViewTabs: two text titles, the selected one
 * in the card-title style (18 semibold) and the other muted. Tapping the active
 * tab returns to the current period.
 */
export function ViewTabs({ value, onChange }: ViewTabsProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist" accessibilityLabel="Transaction view">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.value === 'month' ? 'Month view' : 'Year view'}>
            <ThemedText themeColor={selected ? 'text' : 'textSecondary'} style={styles.label}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three, // web gap-4
  },
  label: {
    fontSize: 18, // web text-lg
    lineHeight: 28,
    fontWeight: '600',
  },
});
