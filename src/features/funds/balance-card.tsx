import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { TOP_LEVEL_FUND_CATEGORIES } from '@/domain/types';
import {
  useFundBalances,
  type FundWithBalance,
} from '@/features/funds/use-fund-balances';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';

/**
 * The Balance card: every fund account and what it is worth.
 *
 * Grouped by the fund's top-level category, largest group first, and within a
 * group the largest fund first — the web app sorts the same way, and it puts the
 * money the user cares about at the top rather than wherever they happened to be
 * created.
 *
 * The total is always covered by privacy mode: it is the single most sensitive
 * number on the screen.
 */
export function BalanceCard({ embedded = false }: { embedded?: boolean }) {
  const theme = useTheme();
  const { data, isLoading, error } = useFundBalances();
  const [expanded, setExpanded] = useState(false);

  // Inactive funds stay in the total — their money still exists — but leave the
  // list, matching the web app.
  const groups = useMemo(
    () => groupByTopLevel((data?.funds ?? []).filter((fund) => fund.is_active)),
    [data],
  );

  if (error) {
    return (
      <View style={embedded ? styles.embedded : [styles.card, { backgroundColor: theme.card }]}>
        {embedded ? null : (
          <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
            BALANCE
          </ThemedText>
        )}
        <ThemedText themeColor="destructive" style={styles.errorText}>
          {messageOf(error)}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={embedded ? styles.embedded : [styles.card, { backgroundColor: theme.card }]}>
      {embedded ? null : (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel="Balance"
          style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.headerLeft}>
            <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
              BALANCE
            </ThemedText>
            {isLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <PrivacyValue style={styles.total}>
                {formatCurrency(data?.totalEUR ?? 0, 'EUR')}
              </PrivacyValue>
            )}
          </View>

          <SymbolView
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={13}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}

      {embedded || expanded
        ? groups.map((group) => <GroupRow key={group.name} group={group} />)
        : null}
    </View>
  );
}

type FundGroup = {
  name: string;
  funds: FundWithBalance[];
  totalEUR: number;
};

/**
 * Groups funds by their top-level category, largest first.
 *
 * Funds with no top-level category are collected under "Other" rather than
 * dropped — every fund's money counts toward the total, so every fund needs a
 * home in the list.
 *
 * @param funds Funds with balances.
 * @returns Groups, ordered by EUR total descending.
 */
function groupByTopLevel(funds: FundWithBalance[]): FundGroup[] {
  const byName = new Map<string, FundWithBalance[]>();

  for (const fund of funds) {
    // Only known top-level names are used as headings, so a stray value does
    // not produce a group of one with a meaningless title.
    const name =
      fund.top_level_category &&
      (TOP_LEVEL_FUND_CATEGORIES as readonly string[]).includes(fund.top_level_category)
        ? fund.top_level_category
        : 'Other';

    const bucket = byName.get(name);
    if (bucket) bucket.push(fund);
    else byName.set(name, [fund]);
  }

  return [...byName.entries()]
    .map(([name, groupFunds]) => ({
      name,
      funds: [...groupFunds].sort((a, b) => b.currentEurAmount - a.currentEurAmount),
      totalEUR: groupFunds.reduce((sum, fund) => sum + fund.currentEurAmount, 0),
    }))
    .sort((a, b) => b.totalEUR - a.totalEUR);
}

function GroupRow({ group }: { group: FundGroup }) {

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <ThemedText themeColor="textSecondary" style={styles.groupName}>
          {group.name}
        </ThemedText>
        <PrivacyValue themeColor="textSecondary" style={styles.groupTotal}>
          {formatCurrency(group.totalEUR, 'EUR')}
        </PrivacyValue>
      </View>

      {group.funds.map((fund) => (
        <FundRow key={fund.id} fund={fund} />
      ))}
    </View>
  );
}

function FundRow({ fund }: { fund: FundWithBalance }) {
  const isForeign = fund.currency !== 'EUR';

  return (
    <View style={styles.fundRow}>
      <ThemedText style={styles.fundName} numberOfLines={1}>
        {fund.name}
      </ThemedText>

      <View style={styles.fundAmounts}>
        <PrivacyValue style={styles.fundAmount}>
          {formatCurrency(fund.currentEurAmount, 'EUR')}
        </PrivacyValue>

        {/* The native-currency figure, which only differs for a foreign fund
            and is what the money is actually held in. */}
        {isForeign ? (
          <PrivacyValue themeColor="textSecondary" style={styles.fundOriginal}>
            {formatCurrency(fund.currentAmount, fund.currency)}
          </PrivacyValue>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
  },
  embedded: {
    // Inside the Net worth card: no chrome, and the groups carry their own
    // horizontal padding.
    paddingTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 28,
    // Explicit, because `ThemedText`'s default variant sets `lineHeight: 24`.
    // Overriding only the font size leaves the glyphs overflowing that box, so
    // the top of the number is clipped and it rides up under the label above.
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  group: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  groupName: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  groupTotal: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.half,
  },
  fundName: {
    flex: 1,
    fontSize: 15,
  },
  fundAmounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  fundAmount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  fundOriginal: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
