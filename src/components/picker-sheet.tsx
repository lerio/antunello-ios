import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isMultiSelection,
  PickerList,
  type PickerOption,
  type PickerListProps,
} from '@/components/picker-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { PickerOption };

type PickerSheetProps = Pick<PickerListProps, 'options' | 'selected' | 'onSelect' | 'onToggle' | 'searchable'> & {
  visible: boolean;
  title: string;
  onClose: () => void;
};

/**
 * A bottom sheet for choosing options from a list.
 *
 * Hand-rolled on React Native's `Modal` rather than pulling in a sheet library:
 * the behaviour needed here is small and well understood, and avoiding the
 * dependency keeps the native build lean.
 *
 * The list itself lives in `PickerList`, so the filter controls can show the
 * same thing inside their own sheet without nesting one modal in another.
 *
 * A single choice closes the sheet, since the tap is the answer; a multi-select
 * stays open until Done, since the user is still assembling a set.
 */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onToggle,
  onClose,
  searchable = false,
}: PickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isMulti = isMultiSelection(selected);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.separator }]} />

        <View style={styles.header}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <ThemedText style={{ color: theme.tint }}>Done</ThemedText>
          </Pressable>
        </View>

        <PickerList
          // Remounts on each open, so the search box does not keep the last query.
          key={visible ? 'open' : 'closed'}
          options={options}
          searchable={searchable}
          selected={selected}
          // A single choice is the answer, so the sheet closes on the tap. A
          // multi-select is still being assembled, so it stays open until Done.
          onSelect={
            isMulti
              ? undefined
              : (value: string) => {
                  onClose();
                  onSelect?.(value);
                }
          }
          onToggle={isMulti ? onToggle : undefined}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingTop: Spacing.two,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
