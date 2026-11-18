import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
 * Matches the web app's TransactionViewTabs: muted container, foreground pill
 * for the active tab. Tapping the active tab returns to the current period.
 */
export function ViewTabs({ value, onChange }: ViewTabsProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement }, // bg-muted
      ]}
      accessibilityRole="tablist"
      accessibilityLabel="Transaction view">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.value === 'month' ? 'Month view' : 'Year view'}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.text }, // bg-foreground
            ]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? theme.background : theme.textSecondary }, // text-background / text-muted-foreground
              ]}>
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
    borderRadius: Radius.medium + 2, // rounded-lg equivalent
    padding: 3, // p-1 = 4px, but we'll use 3 for the gap
    gap: 2, // gap-1
  },
  segment: {
    paddingHorizontal: 12, // px-3 = 12px
    paddingVertical: 6, // py-1.5 = 6px
    borderRadius: Radius.small, // rounded-md
  },
  label: {
    fontSize: 14, // text-sm
    fontWeight: '500', // font-medium
  },
});
