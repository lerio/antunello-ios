import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ViewTabsProps = {
  value: 'month' | 'year';
  onChange: (value: 'month' | 'year') => void;
};

/**
 * The Month / Year switch.
 *
 * Two segments rather than a native segmented control, because both are
 * navigation rather than a filter — and because the tab bar below already
 * carries the selection weight that a segmented control would compete with.
 */
export function ViewTabs({ value, onChange }: ViewTabsProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {(['month', 'year'] as const).map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option === 'month' ? 'Month view' : 'Year view'}
            style={[styles.segment, selected && { backgroundColor: theme.card }]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? theme.text : theme.textSecondary },
              ]}>
              {option === 'month' ? 'Month' : 'Year'}
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
    alignSelf: 'center',
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
