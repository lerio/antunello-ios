import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { readThemePreference, saveThemePreference } from '@/features/appearance/appearance';
import { THEME_PREFERENCES, type ThemePreference } from '@/features/appearance/theme-preference';
import { hapticSelect } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

/** A three-way choice: follow the system, or force light or dark. */
export function ThemePreferencePicker() {
  const theme = useTheme();
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  function choose(next: ThemePreference) {
    setPreference(next);
    saveThemePreference(next);
    hapticSelect();
  }

  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {THEME_PREFERENCES.map(({ value, label }) => {
        const selected = value === preference;
        return (
          <Pressable
            key={value}
            onPress={() => choose(value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText
              style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: Radius.small,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.small - 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
