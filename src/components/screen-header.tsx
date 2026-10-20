import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePrivacy } from '@/features/privacy/privacy-provider';
import { useTheme } from '@/hooks/use-theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

/**
 * The compact header shared by the top-level tabs.
 *
 * A large navigation bar with a collapsing title would cost more vertical space
 * than the two-card Home screen can spare. This keeps the title, an optional
 * one-line subtitle, and the hide-balances toggle in a single ~60pt band.
 */
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const theme = useTheme();
  const { enabled, toggle } = usePrivacy();

  return (
    <View style={[styles.header, { borderBottomColor: theme.separator }]}>
      <View style={styles.text}>
        <ThemedText
          accessibilityRole="header"
          style={styles.title}
          numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            themeColor="textSecondary"
            style={styles.subtitle}
            numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={enabled ? 'Show balances' : 'Hide balances'}
        style={[styles.action, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={enabled ? 'eye.slash' : 'eye'}
          size={17}
          tintColor={theme.text}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  action: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
