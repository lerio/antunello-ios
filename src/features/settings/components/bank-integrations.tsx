import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import {
  hasExpiredSession,
  isBankConnected,
  lastSyncFor,
  SUPPORTED_BANKS,
  type BankDefinition,
  type IntegrationConfig,
} from '@/features/settings/integration-status';
import { useIntegrations } from '@/features/settings/use-integrations';
import { useTheme } from '@/hooks/use-theme';

/** The deployed web app, where connections are actually made. */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/**
 * Which banks are connected, and a way to manage them.
 *
 * The list is the web app's, statuses and all, but every action leads to the
 * browser. That is not a shortcut: the Enable Banking flow signs a JWT with a
 * private key that must never be on a phone, and Trade Republic's needs a phone
 * number, a PIN and an app confirmation. Reimplementing either would mean
 * shipping secrets in exchange for replacing something that already works.
 *
 * A consequence worth knowing about, and the reason the explanation below is on
 * the screen rather than only in this comment: `SFSafariViewController` has its
 * own cookie jar, so the first time the browser opens it is **signed out**. The
 * user has to sign in there before they can see the settings page.
 */
export function BankIntegrations() {
  const theme = useTheme();
  const { data: accounts, isLoading, isError } = useIntegrations();

  function openWebSettings() {
    if (!WEB_URL) return;
    void WebBrowser.openBrowserAsync(`${WEB_URL}/protected/settings`);
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {isLoading ? <ActivityIndicator /> : null}

        {isError ? (
          <ThemedText themeColor="destructive">
            Couldn’t load your bank connections.
          </ThemedText>
        ) : null}

        {accounts
          ? SUPPORTED_BANKS.map((bank, index) => (
              <BankRow
                key={bank.name}
                bank={bank}
                accounts={accounts}
                isLast={index === SUPPORTED_BANKS.length - 1}
              />
            ))
          : null}
      </View>

      <Pressable
        onPress={openWebSettings}
        accessibilityRole="button"
        accessibilityLabel="Manage bank connections in the browser"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
        ]}>
        <SymbolView name="safari" size={16} tintColor={theme.tint} />
        <ThemedText themeColor="tint" style={styles.buttonLabel}>
          Manage in browser
        </ThemedText>
      </Pressable>

      <ThemedText themeColor="textSecondary" style={styles.footnote}>
        Connecting and re-authenticating happen in the browser, where the bank&apos;s own
        sign-in runs. The browser opens signed out the first time — sign in once and it
        will remember.
      </ThemedText>
    </>
  );
}

/** One bank: its name, its status, and when it last synced. */
function BankRow({
  bank,
  accounts,
  isLast,
}: {
  bank: BankDefinition;
  accounts: IntegrationConfig[];
  isLast: boolean;
}) {
  const theme = useTheme();

  const connected = isBankConnected(accounts, bank.name);
  const expired = hasExpiredSession(accounts, bank.name);
  const lastSync = lastSyncFor(accounts, bank.name);

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
      ]}>
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <ThemedText style={styles.bankName}>{bank.name}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.country}>
            {bank.country}
          </ThemedText>
          {connected ? (
            <StatusPill
              label="Connected"
              color={theme.income}
              // An expired session keeps the connection but needs the user, so
              // the pill says which of the two they are looking at.
              note={expired ? 'Session expired' : undefined}
              noteColor={theme.warning}
            />
          ) : null}
        </View>

        <ThemedText themeColor="textSecondary" style={styles.detail}>
          {connected && lastSync ? `Last synced ${formatSync(lastSync)}` : bank.description}
        </ThemedText>
      </View>
    </View>
  );
}

function StatusPill({
  label,
  color,
  note,
  noteColor,
}: {
  label: string;
  color: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <View style={styles.pills}>
      <View style={[styles.pill, { borderColor: color }]}>
        <ThemedText style={[styles.pillLabel, { color }]}>{label}</ThemedText>
      </View>
      {note && noteColor ? (
        <View style={[styles.pill, { borderColor: noteColor }]}>
          <ThemedText style={[styles.pillLabel, { color: noteColor }]}>{note}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * A sync time as a short relative phrase.
 *
 * The web app shows nothing here at all; a timestamp is useful on a phone
 * because it is the only way to tell a working connection from one that stopped
 * syncing weeks ago.
 */
function formatSync(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.two,
  },
  rowText: {
    gap: Spacing.half,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
  },
  country: {
    fontSize: 12,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  pill: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 1,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    height: 44,
    borderRadius: Radius.medium,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
  },
});
