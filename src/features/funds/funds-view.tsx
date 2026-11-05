import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { groupFunds, type FundGroup } from '@/features/funds/group-funds';
import { useFundBalances, type FundWithBalance } from '@/features/funds/use-fund-balances';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';

/** The SF Symbol for a currency, matching the web app's per-currency icons. */
function currencySymbol(currency: string): SFSymbol {
  switch (currency) {
    case 'EUR':
      return 'eurosign.circle';
    case 'JPY':
      return 'yensign.circle';
    case 'USD':
    case 'CAD':
    case 'AUD':
      return 'dollarsign.circle';
    case 'GBP':
      return 'sterlingsign.circle';
    default:
      return 'centsign.circle';
  }
}

/**
 * Every fund and its balance, grouped by top-level category.
 *
 * The Home card shows only the total; this is where the individual amounts
 * live.
 */
export function FundsView() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useFundBalances();

  const { groups, totalEUR } = useMemo(
    () => groupFunds(data?.funds ?? []),
    [data],
  );

  return (
    <Screen insetTop={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.three },
        ]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : isError ? (
          <EmptyState
            style={styles.empty}
            title="Couldn’t load funds"
            detail={messageOf(error)}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            style={styles.empty}
            title="No funds yet"
            detail="Fund accounts are set up in the web app’s admin settings."
          />
        ) : (
          <>
            <TotalCard totalEUR={totalEUR} />
            {groups.map((group) => (
              <GroupCard key={group.name} group={group} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Every fund's balance converted to EUR and summed. */
function TotalCard({ totalEUR }: { totalEUR: number }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator },
      ]}>
      <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
        TOTAL
      </ThemedText>
      <PrivacyValue style={styles.total}>{formatCurrency(totalEUR, 'EUR')}</PrivacyValue>
    </View>
  );
}

/** One top-level category and the funds inside it. */
function GroupCard({ group }: { group: FundGroup }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator },
      ]}>
      <View style={styles.groupHead}>
        <ThemedText style={styles.groupName} numberOfLines={1}>
          {group.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.groupMeta}>
          {`${group.funds.length} fund${group.funds.length === 1 ? '' : 's'}`}
        </ThemedText>
        <PrivacyValue themeColor="textSecondary" style={styles.groupTotal}>
          {formatCurrency(group.totalEUR, 'EUR')}
        </PrivacyValue>
      </View>

      {group.funds.map((fund, index) => (
        <FundRow
          key={fund.id}
          fund={fund}
          divider={index > 0 ? theme.separator : undefined}
        />
      ))}
    </View>
  );
}

/** One fund: what it is called and what it currently holds. */
function FundRow({ fund, divider }: { fund: FundWithBalance; divider?: string }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        divider && { borderTopColor: divider, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <SymbolView
        name={currencySymbol(fund.currency)}
        size={16}
        tintColor={theme.textSecondary}
      />
      <View style={styles.rowText}>
        <ThemedText style={styles.fundName} numberOfLines={1}>
          {fund.name}
        </ThemedText>
        {fund.description ? (
          <ThemedText themeColor="textSecondary" style={styles.fundDescription} numberOfLines={1}>
            {fund.description}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.amounts}>
        <PrivacyValue style={styles.amount}>
          {formatCurrency(fund.currentAmount, fund.currency)}
        </PrivacyValue>
        {fund.currency !== 'EUR' ? (
          <PrivacyValue themeColor="textSecondary" style={styles.eurAmount}>
            {formatCurrency(fund.currentEurAmount, 'EUR')}
          </PrivacyValue>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  loading: {
    marginTop: Spacing.five,
  },
  empty: {
    justifyContent: 'flex-start',
    paddingTop: Spacing.six,
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 32,
    // Explicit: ThemedText's default lineHeight is 24 and would clip the glyphs.
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  groupName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  groupMeta: {
    fontSize: 12,
  },
  groupTotal: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  fundName: {
    fontSize: 15,
  },
  fundDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  amount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  eurAmount: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
