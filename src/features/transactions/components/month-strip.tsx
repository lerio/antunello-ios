import { useCallback, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { MonthOption } from '@/features/transactions/use-available-months';
import { useTheme } from '@/hooks/use-theme';

/** Fixed, so `getItemLayout` can be exact and `initialScrollIndex` can work. */
const ITEM_WIDTH = 78;
const ITEM_GAP = Spacing.one;

type MonthStripProps = {
  months: MonthOption[];
  /** Index of the selected month within `months`. */
  selectedIndex: number;
  onSelect: (month: MonthOption) => void;
};

/**
 * A horizontally scrolling month selector that keeps the selection centred.
 *
 * The web app does this with `offsetLeft`/`clientWidth` arithmetic and refs
 * tracking whether it is the initial mount. `scrollToIndex` with a
 * `viewPosition` does the same thing declaratively and is idempotent, so none of
 * that bookkeeping is needed.
 *
 * Two details make the centring work:
 *
 *  - `getItemLayout` gives exact offsets, without which `scrollToIndex` cannot
 *    scroll to an item that has not been rendered yet.
 *  - The content is padded by half a screen, so the first and last months can
 *    reach the centre rather than stopping at the edge.
 */
export function MonthStrip({ months, selectedIndex, onSelect }: MonthStripProps) {
  const theme = useTheme();
  const listRef = useRef<FlatList<MonthOption>>(null);
  const { width: screenWidth } = useWindowDimensions();

  const sidePadding = Math.max(0, screenWidth / 2 - ITEM_WIDTH / 2);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= months.length) return;
    listRef.current?.scrollToIndex({
      index: selectedIndex,
      viewPosition: 0.5,
      animated: true,
    });
  }, [selectedIndex, months.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: MonthOption; index: number }) => {
      const isSelected = index === selectedIndex;

      // Selected wins over today, which wins over future.
      const background = isSelected
        ? theme.text
        : item.isToday
          ? theme.backgroundSelected
          : 'transparent';

      const labelColor = isSelected
        ? theme.background
        : item.isFuture
          ? theme.textSecondary
          : theme.text;

      return (
        <Pressable
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={item.label}
          style={[styles.item, { backgroundColor: background }]}>
          <ThemedText style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {item.shortLabel}
          </ThemedText>
        </Pressable>
      );
    },
    [selectedIndex, theme, onSelect],
  );

  return (
    <FlatList
      ref={listRef}
      data={months}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => `${item.year}-${item.month}`}
      renderItem={renderItem}
      contentContainerStyle={{ paddingHorizontal: sidePadding }}
      ItemSeparatorComponent={Gap}
      getItemLayout={(_, index) => ({
        length: ITEM_WIDTH + ITEM_GAP,
        offset: (ITEM_WIDTH + ITEM_GAP) * index,
        index,
      })}
      initialScrollIndex={selectedIndex >= 0 ? selectedIndex : 0}
      // Without this, `initialScrollIndex` throws when the list has not yet
      // measured, which is exactly the case on first render.
      onScrollToIndexFailed={({ index }) => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
        });
      }}
    />
  );
}

/** The gap between chips, matching `ITEM_GAP` in `getItemLayout`. */
function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  item: {
    width: ITEM_WIDTH,
    height: 36,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  gap: {
    width: ITEM_GAP,
  },
});
