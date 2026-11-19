import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CardShadow, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one card surface: web's `rounded-2xl border bg-card shadow-sm p-4`.
 *
 * Callers add layout (a margin, a different gap) through `style`, never their
 * own radius, padding or colours.
 */
export function Card({ children, style }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator },
        style,
      ]}>
      {children}
    </View>
  );
}

type CardToggleProps = {
  open: boolean;
  onPress: () => void;
  openLabel: string;
  closedLabel: string;
};

/**
 * The expand/collapse caret in a card's title row: 32×32, like web's `h-8 w-8`
 * and the budget card's edit button. `hitSlop` keeps the tap target at 44.
 */
export function CardToggle({ open, onPress, openLabel, closedLabel }: CardToggleProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? openLabel : closedLabel}
      style={styles.toggle}>
      <SymbolView
        name={open ? 'chevron.up' : 'chevron.down'}
        size={13}
        tintColor={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Layout.cardGap,
    ...CardShadow,
  },
  toggle: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** For a card that is itself pressable: spread it and add the theme colours. */
export const cardStyle = styles.card;
