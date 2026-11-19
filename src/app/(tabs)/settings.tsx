import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Card, cardStyle } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Layout, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { usePrivacy } from '@/features/privacy/privacy-provider';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { BankIntegrations } from '@/features/settings/components/bank-integrations';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';

/**
 * Settings.
 *
 * Bank connections, account, privacy mode and a connectivity check.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { enabled: privacyEnabled, setEnabled: setPrivacyEnabled } = usePrivacy();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to see your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        // Report a failure rather than discarding it: the local cache is
        // cleared either way, so a silent failure leaves the user apparently
        // signed out with an empty app and no explanation.
        onPress: () => {
          signOut().catch((error) => Alert.alert('Could not sign out', messageOf(error)));
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        <BankIntegrations />

        <ThemedText style={styles.sectionLabel}>
          Account
        </ThemedText>

        <Card>
          <ThemedText themeColor="textSecondary" style={styles.rowLabel}>
            Signed in as
          </ThemedText>
          <ThemedText selectable>{session?.user.email ?? 'Unknown'}</ThemedText>
        </Card>

        <Pressable
          onPress={() => router.push('/change-password')}
          accessibilityRole="button"
          style={({ pressed }) => [
            cardStyle,
            { backgroundColor: theme.card, borderColor: theme.separator, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText>Change password</ThemedText>
        </Pressable>

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            cardStyle,
            { backgroundColor: theme.card, borderColor: theme.separator, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText themeColor="destructive">Sign out</ThemedText>
        </Pressable>

        <ThemedText style={styles.sectionLabel}>
          Privacy
        </ThemedText>

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText>Hide amounts</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Covers financial values without changing the layout.
              </ThemedText>
            </View>
            <Switch value={privacyEnabled} onValueChange={setPrivacyEnabled} />
          </View>

          {/* Preview so the effect can be checked without leaving Settings. */}
          <View style={[styles.preview, { borderTopColor: theme.separator }]}>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Preview
            </ThemedText>
            <View style={styles.previewRow}>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Income
              </ThemedText>
              <PrivacyValue style={[styles.amount, { color: theme.income }]}>
                +€2,480.00
              </PrivacyValue>
            </View>
            <View style={styles.previewRow}>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Balance
              </ThemedText>
              <PrivacyValue style={[styles.amount, { color: theme.text }]}>
                €18,204.55
              </PrivacyValue>
            </View>
            <View style={styles.previewRow}>
              <ThemedText themeColor="textSecondary" style={styles.hint}>
                Expense, never hidden
              </ThemedText>
              <PrivacyValue hidden={false} style={[styles.amount, { color: theme.expense }]}>
                −€34.90
              </PrivacyValue>
            </View>
          </View>
        </Card>

        <Card>
          <ThemedText themeColor="textSecondary" style={styles.rowLabel}>
            Supabase project
          </ThemedText>
          <ThemedText selectable style={styles.mono}>
            {(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('https://', '')}
          </ThemedText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Layout.gutter,
    paddingTop: Layout.pageTop,
    gap: Layout.stackGap,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    // Pull the card up to the label: the stack gap is for sibling cards.
    marginBottom: -(Layout.stackGap - Layout.cardGap),
  },
  rowLabel: {
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: {
    flex: 1,
    gap: Spacing.half,
  },
  hint: {
    fontSize: 13,
  },
  preview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  mono: {
    fontSize: 13,
    fontFamily: 'ui-monospace',
  },
});
