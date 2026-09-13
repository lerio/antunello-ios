import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  detail: string;
  /**
   * Replaces the container's layout.
   *
   * The default centres in whatever space it is given, which is right for an
   * empty list — a `ListEmptyComponent` inside a container that has been told to
   * grow. A screen that is a plain scroll view has no such space, so it passes
   * its own padding instead.
   */
  style?: StyleProp<ViewStyle>;
};

/**
 * What a screen shows when it has nothing to show.
 *
 * Four identical copies of this had accumulated, one per list screen, plus
 * three hand-inlined copies in the pending review. They differed only in the
 * container's layout, which is what the `style` prop is for.
 */
export function EmptyState({ title, detail, style }: EmptyStateProps) {
  return (
    <View style={[styles.centered, style]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.detail}>
        {detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  detail: {
    textAlign: 'center',
  },
});
