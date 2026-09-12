import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pulsing placeholder in the shape of what is coming.
 *
 * The point is not decoration. A spinner says "wait" and nothing else, and the
 * layout it sits in has to be guessed at, so the screen jumps when the data
 * lands. A skeleton says what is arriving and reserves its space, so the content
 * appears where the eye is already looking.
 *
 * The pulse is opacity on the native driver, which keeps it off the JS thread —
 * a placeholder that stutters while the data it stands in for is being fetched
 * would be worse than no placeholder.
 */
export function Skeleton({ width = '100%', height = 16, radius = Radius.small, style }: SkeletonProps) {
  const theme = useTheme();
  // State rather than a ref: the value is created once and then only ever
  // animated, and `useRef(...).current` reads a ref during render, which React
  // forbids for the good reason that it does not re-render when it changes.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );

    animation.start();
    // Stopped on unmount: a looping animation holds a native handle, and a
    // screen that has finished loading would otherwise keep one alive.
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      // Hidden from assistive technology: it conveys nothing a screen reader
      // could usefully read out, and the loading state is announced elsewhere.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.backgroundElement },
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }) },
        style,
      ]}
    />
  );
}

/**
 * Placeholder rows for a list that has not arrived.
 *
 * Shaped like a transaction row — a circular icon, two lines of text, a figure
 * on the right — because that is what the list will contain, and matching the
 * shape is the whole reason to use a skeleton rather than a spinner.
 */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={38} height={38} radius={19} />
          <View style={styles.rowText}>
            {/* Varied widths, so the placeholder reads as text of differing
                lengths rather than as a stack of identical bars. */}
            <Skeleton width={`${55 + ((index * 13) % 30)}%`} height={13} />
            <Skeleton width={`${30 + ((index * 7) % 25)}%`} height={11} />
          </View>
          <Skeleton width={72} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one + 2,
  },
});
