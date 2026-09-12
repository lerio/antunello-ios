import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Chip width and the gap between chips, which together form the scroll stride. */
const ITEM_WIDTH = 78;
const ITEM_GAP = Spacing.one;
const CHIP_HEIGHT = 36;

export type StripItem = {
  /** Stable identity, used as the React key. */
  key: string;
  /** Short text shown in the chip. */
  label: string;
  isToday: boolean;
  isFuture: boolean;
};

type ChipStripProps = {
  items: StripItem[];
  /** Index of the selected item, or -1 when it is not in the list. */
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Announced to screen readers alongside the item label. */
  accessibilityLabel?: string;
};

/**
 * A horizontally scrolling strip of chips that keeps the selection centred.
 *
 * Shared by the month and year selectors, which differ only in what they list.
 * Extracted rather than duplicated because the centring arithmetic is subtle
 * enough to have been wrong once already: a `FlatList` with
 * `contentContainerStyle` padding and `getItemLayout` mis-scrolls unless the
 * padding is folded into the reported offsets.
 *
 * A `ScrollView` rather than a `FlatList`: a few dozen chips need no
 * virtualisation, and owning the arithmetic directly is shorter and easier to
 * reason about than making the list's offsets agree with the padding.
 *
 * The layout makes the centring collapse to `index * stride` — the content is
 * padded by half a screen each side so the first and last chips can reach the
 * centre, and that padding exactly cancels the half-screen term in the
 * calculation.
 */
export function ChipStrip({
  items,
  selectedIndex,
  onSelect,
  accessibilityLabel,
}: ChipStripProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const sidePadding = Math.max(0, screenWidth / 2 - ITEM_WIDTH / 2);
  const stride = ITEM_WIDTH + ITEM_GAP;

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    scrollRef.current?.scrollTo({ x: selectedIndex * stride, animated: true });
  }, [selectedIndex, items.length, stride]);

  // A horizontal ScrollView sizes to its content, so with no items it would
  // collapse to nothing and silently vanish. Saying so beats an empty gap.
  if (items.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.empty}>
        Nothing to show
      </ThemedText>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // Pinned rather than content-sized: without a height of its own it can
      // collapse to zero if the parent imposes no constraint, which reads as
      // the selector silently disappearing.
      style={styles.scroller}
      contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;

        // Selected wins over today, which wins over future.
        const backgroundColor = isSelected
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
            key={item.key}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              accessibilityLabel ? `${accessibilityLabel}: ${item.label}` : item.label
            }
            style={[styles.item, { backgroundColor }]}>
            <ThemedText style={[styles.label, { color: labelColor }]} numberOfLines={1}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    height: CHIP_HEIGHT,
    flexGrow: 0,
  },
  content: {
    gap: ITEM_GAP,
    alignItems: 'center',
  },
  item: {
    width: ITEM_WIDTH,
    height: CHIP_HEIGHT,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    height: CHIP_HEIGHT,
    lineHeight: CHIP_HEIGHT,
  },
});
