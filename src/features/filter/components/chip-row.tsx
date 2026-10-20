import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export type ChipOption = {
  value: string;
  label: string;
};

type ChipRowProps = {
  options: readonly ChipOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  accessibilityLabel?: string;
};

/**
 * A wrapping row of toggleable chips.
 *
 * For the short, fixed selections — type, currency — where showing every option
 * costs less than a tap to open a picker. Lists long enough to need scrolling go
 * through `PickerSheet` instead.
 */
export function ChipRow({ options, selected, onToggle, accessibilityLabel }: ChipRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);

        return (
          <Pressable
            key={option.value}
            onPress={() => {
              hapticSelect();
              onToggle(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isSelected ? theme.tint : theme.backgroundElement,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText
              style={[
                styles.label,
                { color: isSelected ? theme.onTint : theme.text },
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.small + 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
});
