import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Set false to draw from the very top, for a screen that fills the status bar
   * area itself — a full-bleed chart or a coloured header.
   */
  insetTop?: boolean;
};

/**
 * A tab screen that keeps its content clear of the status bar and Dynamic Island.
 *
 * The root stack sets `headerShown: false`, so no navigation bar is supplying a
 * top inset — without this, content starts at y=0 and the first element sits
 * behind the Dynamic Island, which is invisible in a screenshot and easy to miss
 * on a device if the element is decorative. The month selector was hidden that
 * way.
 *
 * Only the top edge is handled. The bottom is the native tab bar's business, and
 * applying an inset there too would double the gap.
 */
export function Screen({ children, style, insetTop = true }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.flex, insetTop && { paddingTop: insets.top }, style]}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
