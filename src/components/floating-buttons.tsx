import { ArrowUp, Plus, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Kept in step with the list padding that clears the stacked pair. */
export const FLOATING_BUTTON_SIZE = 54;
/** The web app stacks its two floating buttons 16px apart. */
const STACK_GAP = Spacing.three;

type FloatingButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  bottom: number;
};

function FloatingButton({ icon: Icon, label, onPress, bottom }: FloatingButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.tint,
          bottom,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Icon size={24} color={theme.onTint} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * The add button, sitting just above the tab bar.
 *
 * `insets.bottom` already includes the native tab bar inside a tab screen, so
 * adding `BottomTabInset` here would double-count it and leave the button
 * floating halfway up the list.
 */
export function AddTransactionButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <FloatingButton
      icon={Plus}
      label="Add transaction"
      onPress={onPress}
      bottom={insets.bottom + Spacing.three}
    />
  );
}

/** Appears above the add button once the list has scrolled down. */
export function ScrollToTopButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <FloatingButton
      icon={ArrowUp}
      label="Scroll to top"
      onPress={onPress}
      bottom={
        insets.bottom + Spacing.three + FLOATING_BUTTON_SIZE + STACK_GAP
      }
    />
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    width: FLOATING_BUTTON_SIZE,
    height: FLOATING_BUTTON_SIZE,
    borderRadius: FLOATING_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
