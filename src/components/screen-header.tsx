import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const { enabled, toggle } = usePrivacy();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.header,
          borderBottomColor: theme.separator,
          // Screen reserves the status-bar inset above us; pull the header up
          // over it so the bar's colour continues behind the status bar.
          marginTop: -insets.top,
          paddingTop: insets.top + Spacing.one,
        },
      ]}>
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
        {enabled ? (
          <EyeOff size={18} color={theme.text} strokeWidth={2} />
        ) : (
          <Eye size={18} color={theme.text} strokeWidth={2} />
        )}
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
