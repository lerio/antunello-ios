import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useFormColors } from '@/hooks/use-form-colors';
import { useTheme } from '@/hooks/use-theme';

/** Web `Modal`: a swipe of more than 50px down on the handle closes the sheet. */
const SWIPE_DISMISS_DISTANCE = 50;
/** Web `Modal`: duration-300 ease-out. */
const ANIMATION_DURATION = 300;

/**
 * A bottom sheet sized to its content, up to almost the full screen.
 *
 * Mirrors the web app's `Modal`: a bordered handle row that closes the sheet on
 * tap or on a downward swipe, over a 50% black backdrop.
 *
 * The transaction routes are presented as transparent modals with no navigator
 * animation, so the sheet can shrink to the form instead of filling the screen
 * like a page sheet, and so it animates itself: the backdrop fades in while only
 * the sheet slides up, as on the web. A navigator slide would carry the dark
 * backdrop up from the bottom with it.
 *
 * `children` may be a function receiving `dismiss`, which plays the exit
 * animation before calling `onDismiss`. Use it for every close, so the sheet
 * slides away instead of vanishing.
 */
export function TransactionSheet({
  children,
  onDismiss,
  avoidKeyboard = false,
}: {
  children: ReactNode | ((dismiss: () => void) => ReactNode);
  onDismiss: () => void;
  /**
   * Lift the whole sheet above the keyboard. For short sheets (budget, fund,
   * category), which sit entirely in the keyboard's area and would otherwise be
   * hidden behind it. The transaction form is tall and scrolls its own fields
   * clear, so it leaves this off.
   */
  avoidKeyboard?: boolean;
}) {
  const theme = useTheme();
  const colors = useFormColors();
  const insets = useSafeAreaInsets();

  // Where the finger came down, to measure the swipe when it lifts.
  const touchStartY = useRef<number | null>(null);

  const { height: windowHeight } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const dismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    Animated.timing(progress, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [progress, onDismiss, isClosing]);

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior="padding"
      enabled={avoidKeyboard}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: colors.sheet,
            paddingBottom: Math.max(insets.bottom, Spacing.two),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [windowHeight, 0],
                }),
              },
            ],
          },
        ]}>
        <Pressable
          onTouchStart={(event) => {
            touchStartY.current = event.nativeEvent.pageY;
          }}
          onTouchEnd={(event) => {
            const start = touchStartY.current;
            touchStartY.current = null;
            if (start !== null && event.nativeEvent.pageY - start > SWIPE_DISMISS_DISTANCE) {
              dismiss();
            }
          }}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close - tap or swipe down"
          style={({ pressed }) => [
            styles.handleRow,
            {
              borderBottomColor: theme.separator,
              backgroundColor: pressed ? theme.backgroundElement : 'transparent',
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.textSecondary }]} />
        </Pressable>
        {typeof children === 'function' ? children(dismiss) : children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', // web bg-black/50
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    overflow: 'hidden',
  },
  // Web: py-4 and a bottom border.
  handleRow: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Web: w-12 h-1 rounded-full bg-muted-foreground/50.
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
});
