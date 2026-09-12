import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickerOption = {
  value: string;
  label: string;
  /** Secondary text, e.g. a fund's currency or a subcategory's parent. */
  detail?: string;
  /** Section heading; consecutive options sharing one are grouped. */
  group?: string;
  /** Renders greyed out and cannot be chosen. */
  disabled?: boolean;
};

type PickerSheetProps = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Shows a filter box. Worth it above roughly a dozen options. */
  searchable?: boolean;
};

/**
 * A bottom sheet for choosing one option from a list.
 *
 * Hand-rolled on React Native's `Modal` rather than pulling in a sheet library:
 * the behaviour needed here is small and well understood, and avoiding the
 * dependency keeps the native build lean.
 *
 * Options carrying the same `group` are rendered under one heading, which is how
 * the fund picker shows its top-level categories without a second component.
 */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchable = false,
}: PickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.detail?.toLowerCase().includes(needle),
    );
  }, [options, query, searchable]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.separator }]} />

        <View style={styles.header}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button">
            <ThemedText style={{ color: theme.tint }}>Done</ThemedText>
          </Pressable>
        </View>

        {searchable ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(option) => option.value}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item, index }) => {
            const isSelected = item.value === selected;
            // Show the heading only on the first option of each group.
            const showGroup =
              item.group !== undefined && item.group !== filtered[index - 1]?.group;

            return (
              <>
                {showGroup ? (
                  <ThemedText themeColor="textSecondary" style={styles.groupHeading}>
                    {item.group}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={() => {
                    handleClose();
                    onSelect(item.value);
                  }}
                  disabled={item.disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: item.disabled }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed ? theme.backgroundElement : 'transparent',
                      opacity: item.disabled ? 0.35 : 1,
                    },
                  ]}>
                  <View style={styles.rowText}>
                    <ThemedText numberOfLines={1}>{item.label}</ThemedText>
                    {item.detail ? (
                      <ThemedText themeColor="textSecondary" style={styles.detail} numberOfLines={1}>
                        {item.detail}
                      </ThemedText>
                    ) : null}
                  </View>

                  {isSelected ? (
                    <SymbolView name="checkmark" size={15} tintColor={theme.tint} />
                  ) : null}
                </Pressable>
              </>
            );
          }}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nothing matches “{query}”
            </ThemedText>
          }
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
  search: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    height: 40,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
  },
  groupHeading: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  detail: {
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
