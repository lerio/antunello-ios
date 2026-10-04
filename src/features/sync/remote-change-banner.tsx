import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useRemoteChanges } from '@/features/sync/use-remote-changes';
import { useTheme } from '@/hooks/use-theme';

/** How long the banner stays before dismissing itself. */
const AUTO_DISMISS_MS = 6_000;

/**
 * "N new transactions available", shown when another device changed the data.
 *
 * The data has already been refetched in place by the time this appears, so it
 * is only a cue — there is nothing to tap but the banner itself, which dismisses
 * it. It sits over the top of the app rather than in any one screen, since the
 * change can arrive wherever the user happens to be.
 */
export function RemoteChangeBanner() {
  const { message, dismiss } = useRemoteChanges();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  if (!message) return null;

  return (
    <Pressable
      onPress={dismiss}
      accessibilityRole="alert"
      accessibilityHint="Dismiss"
      style={[styles.banner, { top: insets.top + Spacing.one, backgroundColor: theme.tint }]}>
      <SymbolView name="arrow.triangle.2.circlepath" size={14} tintColor="#FFFFFF" />
      <ThemedText style={styles.text}>{message}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
