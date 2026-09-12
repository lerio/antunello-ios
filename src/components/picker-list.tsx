import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
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

export type PickerListProps = {
  options: PickerOption[];
  /**
   * The current selection — a single value, or an array for a multi-select.
   *
   * The shape *is* the mode, rather than a separate flag that could disagree
   * with it.
   */
  selected: string | string[] | null;
  /** Called on tap for a single-select list. */
  onSelect?: (value: string) => void;
  /** Called on tap for a multi-select list. */
  onToggle?: (value: string) => void;
  /** Shows a filter box. Worth it above roughly a dozen options. */
  searchable?: boolean;
  style?: object;
};

/** Whether a list with this selection is a multi-select. */
export function isMultiSelection(selected: PickerListProps['selected']): selected is string[] {
  return Array.isArray(selected);
}

/**
 * A searchable, optionally grouped list of options.
 *
 * Separate from `PickerSheet` because the filter controls show a picker *inside*
 * a sheet rather than opening a second one — nesting React Native modals is a
 * presentation case this app has never exercised, and the filter sheet already
 * covers the results it is filtering. Sharing this body means the two cannot
 * diverge in how they search or how they mark a selection.
 *
 * Options carrying the same `group` are rendered under one heading, which is how
 * the fund picker shows its top-level categories.
 */
export function PickerList(props: PickerListProps) {
  const { options, searchable = false } = props;
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const isMulti = isMultiSelection(props.selected);

  // One shape for the membership test: a single selection is a list of one, so
  // the checkmark logic does not need a branch of its own.
  let selected: string[];
  if (Array.isArray(props.selected)) selected = props.selected;
  else selected = props.selected === null ? [] : [props.selected];

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.detail?.toLowerCase().includes(needle),
    );
  }, [options, query, searchable]);

  return (
    <View style={props.style}>
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
          const isSelected = selected.includes(item.value);

          // Show the heading only on the first option of each group.
          const showGroup = item.group !== undefined && item.group !== filtered[index - 1]?.group;

          return (
            <>
              {showGroup ? (
                <ThemedText themeColor="textSecondary" style={styles.groupHeading}>
                  {item.group}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => {
                  if (item.disabled) return;
                  hapticSelect();
                  if (isMulti) props.onToggle?.(item.value);
                  else props.onSelect?.(item.value);
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
  );
}

const styles = StyleSheet.create({
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
