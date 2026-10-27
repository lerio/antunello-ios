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
 * A segmented control rather than two headings: the page title above already
 * carries the heading weight, and a control that looks like text does not read
 * as something tappable. The selected segment is the black pill the web app
 * uses, which inverts in dark mode.
 */
export function ViewTabs({ value, onChange }: ViewTabsProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
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
            style={[styles.segment, selected && { backgroundColor: theme.text }]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? theme.background : theme.textSecondary },
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
    borderRadius: Radius.small + 1,
    padding: 2,
  },
  segment: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.small,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
