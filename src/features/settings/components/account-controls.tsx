import { useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { CardIconButton } from '@/components/card';
import { PickerSheet } from '@/components/picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useFunds } from '@/features/funds/use-funds';
import type { IntegrationSettingsPatch } from '@/features/settings/integration-settings';
import type { IntegrationConfig } from '@/features/settings/integration-status';
import { requestSync, useUpdateIntegrationSettings } from '@/features/settings/mutations';
import { messageOf } from '@/lib/errors';
import { qk } from '@/lib/query-keys';
import { useTheme } from '@/hooks/use-theme';

/** Which fund picker is open, if any. */
type OpenPicker = 'fund' | 'wealthFund' | null;

/**
 * Fetches an account's transactions now. Lives in the bank card's title row,
 * next to the connect/disconnect button, like web.
 */
export function SyncButton({ config, bankName }: { config: IntegrationConfig; bankName: string }) {
  const queryClient = useQueryClient();
  const [isSyncing, setSyncing] = useState(false);

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

      // A sync moves both of the things this screen does not own: the queue the
      // tab badge and the banner read, and the timestamp on the integration. Left
      // alone, the app would announce new transactions and then show a badge of
      // zero until the app was backgrounded.
      void queryClient.invalidateQueries({ queryKey: qk.pending() });
      void queryClient.invalidateQueries({ queryKey: qk.integrations() });
    } catch (error) {
      Alert.alert('Could not sync', messageOf(error));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <CardIconButton
      symbol="arrow.clockwise"
      label={`Fetch ${bankName} transactions now`}
      onPress={handleFetch}
      loading={isSyncing}
    />
  );
}

/**
 * One connected account's fund mapping.
 *
 * Everything here is per *account* rather than per bank, because a bank can have
 * several — Revolut IT and Revolut NL are two connections with their own fund
 * mappings, and a single row per bank could not express that. No container of
 * its own: the fields sit directly in the bank's card.
 */
export function AccountControls({
  config,
}: {
  config: IntegrationConfig;
}) {
  const { data: funds = [] } = useFunds();
  const updateSettings = useUpdateIntegrationSettings();

  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

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

  const fundOptions = [
    { value: '', label: 'None' },
    ...funds.map((fund) => ({ value: fund.id, label: fund.name, detail: fund.currency })),
  ];

  return (
    <View style={styles.container}>
      <FieldRow
        label="Link to Fund"
        value={fundName(settings.fund_category_id)}
        onPress={() => setOpenPicker('fund')}
      />

      {isTradeRepublic ? (
        <FieldRow
          label="Saveback / Round-up Fund"
          value={fundName(settings.wealth_fund_category_id)}
          onPress={() => setOpenPicker('wealthFund')}
        />
      ) : null}

      <PickerSheet
        visible={openPicker === 'fund'}
        title="Link to Fund"
        options={fundOptions}
        selected={settings.fund_category_id ?? ''}
        onSelect={(value) => patch({ fund_category_id: value })}
        onClose={() => setOpenPicker(null)}
        searchable
      />

      <PickerSheet
        visible={openPicker === 'wealthFund'}
        title="Saveback / Round-up Fund"
        options={fundOptions}
        selected={settings.wealth_fund_category_id ?? ''}
        onSelect={(value) => patch({ wealth_fund_category_id: value })}
        onClose={() => setOpenPicker(null)}
        searchable
      />
    </View>
  );
}

/** A labelled select: small label above, the value and a chevron in the field. */
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
    <View style={styles.field}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => [
          styles.fieldRow,
          { borderColor: theme.separator, opacity: pressed ? 0.6 : 1 },
        ]}>
        <ThemedText style={styles.fieldValue} numberOfLines={1}>
          {value}
        </ThemedText>
        <SymbolView name="chevron.down" size={13} tintColor={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldValue: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
