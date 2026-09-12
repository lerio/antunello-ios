import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useFunds } from '@/features/funds/use-funds';
import type { IntegrationSettingsPatch } from '@/features/settings/integration-settings';
import type { IntegrationConfig } from '@/features/settings/integration-status';
import { requestSync, useUpdateIntegrationSettings } from '@/features/settings/mutations';
import { formatSync } from '@/features/settings/relative-time';
import { messageOf } from '@/lib/errors';
import { useTheme } from '@/hooks/use-theme';

/** Which fund picker is open, if any. */
type OpenPicker = 'fund' | 'wealthFund' | null;

/**
 * One connected account: its sync state and what it maps to.
 *
 * Everything here is per *account* rather than per bank, because a bank can have
 * several — Revolut IT and Revolut NL are two connections with their own fund
 * mappings, and a single row per bank could not express that.
 */
export function AccountControls({
  config,
  /** Shown above the controls when a bank has more than one account. */
  showAccountId,
}: {
  config: IntegrationConfig;
  showAccountId: boolean;
}) {
  const theme = useTheme();
  const { data: funds = [] } = useFunds();
  const updateSettings = useUpdateIntegrationSettings();

  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [isSyncing, setSyncing] = useState(false);

  const settings = config.settings ?? {};
  const fundName = (id: string | null | undefined) =>
    funds.find((fund) => fund.id === id)?.name ?? 'None';

  const isTradeRepublic = config.provider === 'trade_republic';

  function patch(changes: IntegrationSettingsPatch) {
    updateSettings.mutate(
      { config, patch: changes },
      { onError: (error) => Alert.alert('Could not save', messageOf(error)) },
    );
  }

  async function handleFetch() {
    setSyncing(true);
    try {
      const outcome = await requestSync(config.account_id);

      if (outcome.error) {
        Alert.alert('Sync problem', outcome.error);
      } else if (outcome.newPending > 0) {
        Alert.alert(
          'Sync complete',
          `${outcome.newPending} new ${outcome.newPending === 1 ? 'transaction' : 'transactions'} to review.`,
        );
      } else {
        Alert.alert('Sync complete', 'No new transactions.');
      }
    } catch (error) {
      Alert.alert('Could not sync', messageOf(error));
    } finally {
      setSyncing(false);
    }
  }

  const fundOptions = [
    { value: '', label: 'None' },
    ...funds.map((fund) => ({ value: fund.id, label: fund.name, detail: fund.currency })),
  ];

  return (
    <View style={[styles.container, { borderTopColor: theme.separator }]}>
      <View style={styles.syncRow}>
        <View style={styles.syncText}>
          {showAccountId ? (
            <ThemedText themeColor="textSecondary" style={styles.accountId} numberOfLines={1}>
              {config.account_id}
            </ThemedText>
          ) : null}
          <ThemedText themeColor="textSecondary" style={styles.lastSync}>
            {config.last_sync_at ? `Last synced ${formatSync(config.last_sync_at)}` : 'Never synced'}
          </ThemedText>
        </View>

        <Pressable
          onPress={handleFetch}
          disabled={isSyncing}
          accessibilityRole="button"
          accessibilityLabel="Fetch transactions now"
          style={({ pressed }) => [
            styles.fetchButton,
            { backgroundColor: theme.backgroundElement, opacity: isSyncing || pressed ? 0.5 : 1 },
          ]}>
          {isSyncing ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <SymbolView name="arrow.clockwise" size={13} tintColor={theme.tint} />
              <ThemedText themeColor="tint" style={styles.fetchLabel}>
                Fetch now
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      <FieldRow
        label="Link to fund"
        value={fundName(settings.fund_category_id)}
        onPress={() => setOpenPicker('fund')}
      />

      {isTradeRepublic ? (
        <FieldRow
          label="Saveback / Round-up fund"
          value={fundName(settings.wealth_fund_category_id)}
          onPress={() => setOpenPicker('wealthFund')}
        />
      ) : null}

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <ThemedText style={styles.switchTitle}>Bulk fetch</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.switchHint}>
            Import the whole history rather than recent activity.
          </ThemedText>
        </View>
        <Switch
          value={settings.bulk_fetch_enabled === true}
          onValueChange={(value) => patch({ bulk_fetch_enabled: value })}
        />
      </View>

      <PickerSheet
        visible={openPicker === 'fund'}
        title="Link to fund"
        options={fundOptions}
        selected={settings.fund_category_id ?? ''}
        onSelect={(value) => patch({ fund_category_id: value })}
        onClose={() => setOpenPicker(null)}
        searchable
      />

      <PickerSheet
        visible={openPicker === 'wealthFund'}
        title="Saveback / Round-up fund"
        options={fundOptions}
        selected={settings.wealth_fund_category_id ?? ''}
        onSelect={(value) => patch({ wealth_fund_category_id: value })}
        onClose={() => setOpenPicker(null)}
        searchable
      />
    </View>
  );
}

/** A tappable row that opens a picker. */
function FieldRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.fieldRow,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.fieldValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  syncText: {
    flex: 1,
    gap: 1,
  },
  accountId: {
    fontSize: 11,
    fontFamily: 'ui-monospace',
  },
  lastSync: {
    fontSize: 12,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minWidth: 108,
    height: 32,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small + 2,
  },
  fetchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: Radius.small + 2,
  },
  fieldLabel: {
    fontSize: 14,
  },
  fieldValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  switchLabel: {
    flex: 1,
    gap: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchHint: {
    fontSize: 12,
  },
});
