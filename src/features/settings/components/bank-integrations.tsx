import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card, CardIconButton } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing } from '@/constants/theme';
import {
  connectionsFor,
  hasExpiredSession,
  SUPPORTED_BANKS,
  type BankDefinition,
  type IntegrationConfig,
} from '@/features/settings/integration-status';
import { AccountControls, SyncButton } from '@/features/settings/components/account-controls';
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
      {/* The settings menu: plain text tabs, like the Month/Year selector. */}
      <View style={styles.tabs} accessibilityRole="tablist">
        <ThemedText
          accessibilityRole="tab"
          accessibilityState={{ selected: true }}
          style={styles.tab}>
          Banks
        </ThemedText>
      </View>

      {isLoading ? <ActivityIndicator /> : null}

      {isError ? (
        <ThemedText themeColor="destructive">
          Couldn&apos;t load your bank connections.
        </ThemedText>
      ) : null}

      {accounts
        ? SUPPORTED_BANKS.map((bank) => (
            <BankRow
              key={bank.name}
              bank={bank}
              accounts={accounts}
              onOpenWeb={openWebSettings}
            />
          ))
        : null}

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
        sign-in runs. The browser opens signed out the first time -- sign in once and it
        will remember.
      </ThemedText>
    </>
  );
}

/** One bank card: name and status, the icon buttons, then a fund mapping per account. */
function BankRow({
  bank,
  accounts,
  onOpenWeb,
}: {
  bank: BankDefinition;
  accounts: IntegrationConfig[];
  onOpenWeb: () => void;
}) {
  const theme = useTheme();

  const connections = connectionsFor(accounts, bank.name);
  const connected = connections.length > 0;
  const expired = hasExpiredSession(accounts, bank.name);

  return (
    <Card style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.rowTitle}>
          <ThemedText style={styles.bankName}>{bank.name}</ThemedText>
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

        <View style={styles.actions}>
          {/* One sync per account: a bank can have several. */}
          {connections.map((config) => (
            <SyncButton key={config.id} config={config} bankName={bank.name} />
          ))}
          {/* Connecting and disconnecting happen in the browser (see above). */}
          <CardIconButton
            symbol={connected ? 'bolt.slash' : 'powerplug'}
            label={connected ? `Disconnect ${bank.name} in the browser` : `Connect ${bank.name} in the browser`}
            onPress={onOpenWeb}
          />
        </View>
      </View>

      {connections.map((config) => (
        <AccountControls key={config.id} config={config} />
      ))}
    </Card>
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

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    // Pull the first card up to the tabs: the stack gap is for sibling cards.
    marginBottom: -(Layout.stackGap - Layout.cardGap),
  },
  tab: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  row: {
    gap: Layout.stackGap,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.iconButton,
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bankName: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
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