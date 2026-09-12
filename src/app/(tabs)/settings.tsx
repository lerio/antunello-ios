import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { usePrivacy } from '@/features/privacy/privacy-provider';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { BankIntegrations } from '@/features/settings/components/bank-integrations';
import { fetchMonthTransactions } from '@/features/transactions/queries';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * Settings.
 *
 * Bank connections, account, privacy mode and a connectivity check.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const { enabled: privacyEnabled, setEnabled: setPrivacyEnabled } = usePrivacy();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to see your data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          BANKS
        </ThemedText>

        <BankIntegrations />

        <ThemedText themeColor="textSecondary" style={[styles.sectionLabel, styles.spaced]}>
          ACCOUNT
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText themeColor="textSecondary" style={styles.rowLabel}>
            Signed in as
          </ThemedText>
          <ThemedText selectable>{session?.user.email ?? 'Unknown'}</ThemedText>
        </View>

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.spaced,
            { backgroundColor: theme.card, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText themeColor="destructive">Sign out</ThemedText>
        </Pressable>

        <ThemedText themeColor="textSecondary" style={[styles.sectionLabel, styles.spaced]}>
          PRIVACY
        </ThemedText>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
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
        </View>

        <ThemedText themeColor="textSecondary" style={[styles.sectionLabel, styles.spaced]}>
          DIAGNOSTICS
        </ThemedText>

        <DataAccessCheck />

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText themeColor="textSecondary" style={styles.rowLabel}>
            Supabase project
          </ThemedText>
          <ThemedText selectable style={styles.mono}>
            {(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace('https://', '')}
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Diagnostics for the data layer.
 *
 * Two things this proves that are otherwise awkward to check:
 *
 *  - **Row-level security resolves the signed-in user.** A known Supabase issue
 *    on React Native has `signInWithPassword` succeed while `auth.uid()`
 *    evaluates to null for later queries, so every RLS-scoped read returns
 *    nothing and the app looks signed in but empty.
 *  - **The month fetcher works end to end** — query, split expansion, sort.
 *    A wrong split expansion would otherwise only show up as a puzzling number
 *    in the month view.
 *
 * Delete once real screens make both obvious on their own.
 */
function DataAccessCheck() {
  const theme = useTheme();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ok'; total: number; month: number; monthLabel: string; splits: number }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const now = new Date();

      const [countResult, monthRows] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }),
        fetchMonthTransactions(now.getFullYear(), now.getMonth() + 1),
      ]);

      if (cancelled) return;

      if (countResult.error) {
        setState({
          status: 'error',
          message: `${countResult.error.code ?? ''} ${countResult.error.message}`.trim(),
        });
        return;
      }

      setState({
        status: 'ok',
        total: countResult.count ?? 0,
        month: monthRows.length,
        monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        splits: monthRows.filter((t) => t.split_across_year).length,
      });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <ThemedText themeColor="textSecondary" style={styles.rowLabel}>
        Data access
      </ThemedText>

      {state.status === 'loading' ? <ActivityIndicator /> : null}

      {state.status === 'error' ? (
        <ThemedText themeColor="destructive" style={styles.mono}>
          {state.message}
        </ThemedText>
      ) : null}

      {state.status === 'ok' ? (
        <>
          <ThemedText style={styles.mono}>
            {state.total.toLocaleString('en-US')} rows visible in total
          </ThemedText>
          <ThemedText style={styles.mono}>
            {state.month.toLocaleString('en-US')} this month ({state.monthLabel}),{' '}
            {state.splits} split
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 13,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.one,
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
  spaced: {
    marginTop: Spacing.three,
  },
});
