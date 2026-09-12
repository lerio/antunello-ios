import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The web app offers times on a 15-minute grid, so the app does too. */
export const MINUTE_INTERVAL = 15;

/**
 * Rounds a time to the nearest 15 minutes.
 *
 * Applied in the model rather than left to the picker. iOS honours
 * `minuteInterval` for the spinner, but a value arriving from elsewhere — an
 * imported bank transaction stamped 14:07 — would otherwise be editable and
 * re-saved at a time the picker itself cannot express.
 *
 * @param date The date to round.
 * @returns A copy on the nearest 15-minute boundary.
 */
export function roundToMinuteInterval(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(Math.round(minutes / MINUTE_INTERVAL) * MINUTE_INTERVAL, 0, 0);
  return rounded;
}

type DateFieldProps = {
  value: Date;
  onChange: (value: Date) => void;
};

/**
 * Date and time, edited with the native iOS pickers.
 *
 * Two rows and two pickers rather than one `mode="datetime"`: iOS documents
 * `minuteInterval` for the time modes, and a combined picker risks silently
 * offering one-minute steps.
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  // `onChange` is deprecated in this version of the picker; `onValueChange`
  // and `onDismiss` split the two cases it used to conflate.
  function handleValueChange(_event: unknown, selected?: Date) {
    if (!selected) return;
    // Android closes the dialog on selection; iOS keeps the picker inline.
    if (Platform.OS === 'android') setMode(null);

    onChange(mode === 'time' ? roundToMinuteInterval(selected) : selected);
  }

  function handleDismiss() {
    if (Platform.OS === 'android') setMode(null);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <PickerRow
        label="Date"
        value={value.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
        onPress={() => setMode(mode === 'date' ? null : 'date')}
        active={mode === 'date'}
      />

      <View style={[styles.divider, { backgroundColor: theme.separator }]} />

      <PickerRow
        label="Time"
        value={value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        onPress={() => setMode(mode === 'time' ? null : 'time')}
        active={mode === 'time'}
      />

      {mode ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minuteInterval={MINUTE_INTERVAL}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
        />
      ) : null}
    </View>
  );
}

function PickerRow({
  label,
  value,
  onPress,
  active,
}: {
  label: string;
  value: string;
  onPress: () => void;
  active: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ expanded: active }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed || active ? theme.backgroundElement : 'transparent' },
      ]}>
      <ThemedText>{label}</ThemedText>
      <ThemedText themeColor="textSecondary">{value}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    minHeight: 46,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
});
