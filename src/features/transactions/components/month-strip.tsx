import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { MonthOption } from '@/features/transactions/use-available-months';
import { useTheme } from '@/hooks/use-theme';

/** Chip width and the gap between chips, which together form the scroll stride. */
const ITEM_WIDTH = 78;
const ITEM_GAP = Spacing.one;
const CHIP_HEIGHT = 36;

type MonthStripProps = {
  months: MonthOption[];
  /** Index of the selected month within `months`, or -1 if it is not listed. */
  selectedIndex: number;
  onSelect: (month: MonthOption) => void;
};

/**
 * A horizontally scrolling month selector that keeps the selection centred.
 *
 * A `ScrollView` rather than a `FlatList`. The selector holds roughly four dozen
 * chips, so virtualisation buys nothing, and it costs a lot of subtlety: a
 * horizontal `FlatList` with `contentContainerStyle` padding and
 * `getItemLayout` needs the padding folded into the reported offsets, and
 * `initialScrollIndex` silently mis-scrolls when that is wrong. Owning the
 * arithmetic directly is both shorter and easier to reason about.
 *
 * The layout is arranged so the centring maths collapses to `index * stride`:
 * the content is padded by half a screen each side, which makes the first and
 * last chips reachable at the centre, and that padding exactly cancels the
 * half-screen term in the centring calculation.
 */
export function MonthStrip({ months, selectedIndex, onSelect }: MonthStripProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const sidePadding = Math.max(0, screenWidth / 2 - ITEM_WIDTH / 2);
  const stride = ITEM_WIDTH + ITEM_GAP;

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= months.length) return;
    scrollRef.current?.scrollTo({ x: selectedIndex * stride, animated: true });
  }, [selectedIndex, months.length, stride]);

  // A horizontal ScrollView sizes to its content, so with no months it would
  // collapse to nothing and silently vanish. Saying so beats an empty gap.
  if (months.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText themeColor="textSecondary" style={styles.emptyLabel}>
          No months to show
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}>
      {months.map((month, index) => {
        const isSelected = index === selectedIndex;

        // Selected wins over today, which wins over future.
        const backgroundColor = isSelected
          ? theme.text
          : month.isToday
            ? theme.backgroundSelected
            : 'transparent';

        const labelColor = isSelected
          ? theme.background
          : month.isFuture
            ? theme.textSecondary
            : theme.text;

        return (
          <Pressable
            key={`${month.year}-${month.month}`}
            onPress={() => onSelect(month)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={month.label}
            style={[styles.item, { backgroundColor }]}>
            <ThemedText style={[styles.label, { color: labelColor }]} numberOfLines={1}>
              {month.shortLabel}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    // Pinned rather than content-sized: a horizontal ScrollView with no height
    // of its own can collapse to zero if its parent imposes no constraint,
    // which reads as the selector silently disappearing.
    height: CHIP_HEIGHT,
    flexGrow: 0,
  },
  content: {
    gap: ITEM_GAP,
    alignItems: 'center',
  },
  empty: {
    height: CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    fontSize: 13,
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
});
