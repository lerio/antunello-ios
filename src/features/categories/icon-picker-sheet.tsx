import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lucideIconByName } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { searchIcons } from '@/features/categories/icon-search';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 6;
const CELL = 52;

type IconPickerSheetProps = {
  visible: boolean;
  /** The selected icon's Lucide component name, or empty for none. */
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
};

/**
 * A bottom sheet of every Lucide icon, searched by name and tag like lucide.dev.
 *
 * The list is virtualised, so the ~2,100 icons cost only the screenful being
 * drawn. A tap chooses the icon and closes the sheet.
 */
export function IconPickerSheet({ visible, selected, onSelect, onClose }: IconPickerSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => searchIcons(query).filter((icon) => lucideIconByName(icon.name)),
    [query],
  );

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
          <ThemedText style={styles.title}>Icon</ThemedText>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <ThemedText style={{ color: theme.tint }}>Done</ThemedText>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search icons"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />

        {results.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No icons match “{query}”.
          </ThemedText>
        ) : (
          <FlatList
            data={results}
            numColumns={COLUMNS}
            keyExtractor={(icon) => icon.name}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={60}
            windowSize={9}
            getItemLayout={(_, index) => ({
              length: CELL,
              offset: CELL * Math.floor(index / COLUMNS),
              index,
            })}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const Icon = lucideIconByName(item.name)!;
              const isSelected = item.name === selected;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.name);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.kebab.replaceAll('-', ' ')}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      backgroundColor: isSelected ? theme.backgroundElement : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}>
                  <Icon size={22} color={isSelected ? theme.tint : theme.text} strokeWidth={2} />
                </Pressable>
              );
            }}
          />
        )}
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
    height: '75%',
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
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: Radius.medium,
    fontSize: 16,
  },
  grid: {
    paddingHorizontal: Spacing.two,
  },
  cell: {
    flex: 1,
    height: CELL,
    maxWidth: `${100 / COLUMNS}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.four,
  },
});
