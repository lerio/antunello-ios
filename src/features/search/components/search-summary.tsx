import { EyeOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import type { Transaction } from '@/domain/types';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { computeSearchTotals, hasHiddenTotals } from '@/features/search/search-totals';
import { useTheme } from '@/hooks/use-theme';

/**
 * Totals for the current search results.
 *
 * The web app puts the hidden figures behind a hover tooltip. There is no hover
 * on a phone, so they are spelled out in a footnote row instead — the same
 * information, reachable without a gesture.
 *
 * Rows that total zero are omitted entirely, as upstream: a search for expense
 * titles has no business showing an "Income €0.00" line.
 */
export function SearchSummary({ transactions }: { transactions: readonly Transaction[] }) {
  const theme = useTheme();
  const totals = computeSearchTotals(transactions);

  const balance = totals.incomeTotal - totals.expenseTotal;
  const showHidden = hasHiddenTotals(totals);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <View style={styles.balanceRow}>
        <ThemedText themeColor="textSecondary" style={styles.label}>
          Balance
        </ThemedText>
        <PrivacyValue
          style={[
            styles.balance,
            { color: balance >= 0 ? theme.income : theme.expense },
          ]}
          numberOfLines={1}>
          {formatCurrency(Math.abs(balance), 'EUR')}
        </PrivacyValue>
      </View>

      {totals.incomeTotal > 0 ? (
        <SummaryRow label="Income" amount={totals.incomeTotal} color={theme.income} />
      ) : null}

      {totals.expenseTotal > 0 ? (
        <SummaryRow label="Expenses" amount={totals.expenseTotal} color={theme.expense} />
      ) : null}

      {showHidden ? (
        <View style={[styles.footnote, { borderTopColor: theme.separator }]}>
          <View style={styles.footnoteHead}>
            <EyeOff size={12} color={theme.textSecondary} strokeWidth={2} />
            <ThemedText themeColor="textSecondary" style={styles.footnoteLabel}>
              {totals.hiddenTransactionCount}{' '}
              {totals.hiddenTransactionCount === 1 ? 'transaction' : 'transactions'} hidden from
              totals
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.footnoteDetail}>
            Income {formatCurrency(totals.hiddenIncomeTotal, 'EUR')} · Expenses{' '}
            {formatCurrency(totals.hiddenExpenseTotal, 'EUR')}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <PrivacyValue style={[styles.amount, { color }]} numberOfLines={1}>
        {formatCurrency(amount, 'EUR')}
      </PrivacyValue>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  balance: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footnoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  footnoteLabel: {
    fontSize: 12,
  },
  footnoteDetail: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
