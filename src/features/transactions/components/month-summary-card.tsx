import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import type { CategoryTotal, MonthSummary } from '@/features/transactions/month-summary';
import { useTheme } from '@/hooks/use-theme';
import { symbolForCategory } from '@/lib/sf-symbols';

/**
 * The month's headline: Gains or Losses, collapsed by default.
 *
 * Mirrors the monthly branch of the web app's `TransactionSummary`. Expanded, it
 * adds the comparison with the previous month, then Income and Expenses (each
 * expandable into categories) and the hidden-expense total. Every figure is an
 * aggregate, so privacy mode covers all of them.
 */
export function MonthSummaryCard({ summary }: { summary: MonthSummary }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);

  const isGains = summary.balance >= 0;
  const tone = isGains ? theme.income : theme.expense;
  const { comparison } = summary;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse month details' : 'Expand month details'}
        style={styles.header}>
        <ThemedText style={[styles.title, { color: tone }]}>{isGains ? 'Gains' : 'Losses'}</ThemedText>

        <View style={styles.headerRight}>
          <PrivacyValue style={[styles.title, { color: tone }]} numberOfLines={1}>
            {formatCurrency(Math.abs(summary.balance), 'EUR')}
          </PrivacyValue>

          {summary.expectedSplitAmountEur > 0 ? (
            <View style={styles.split}>
              <SymbolView name="arrow.triangle.branch" size={12} tintColor={theme.textSecondary} />
              <PrivacyValue themeColor="textSecondary" style={styles.splitAmount} numberOfLines={1}>
                {formatCurrency(summary.expectedSplitAmountEur, 'EUR')}
              </PrivacyValue>
            </View>
          ) : null}

          <SymbolView
            name={expanded ? 'chevron.down' : 'chevron.right'}
            size={12}
            tintColor={theme.textSecondary}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {comparison ? (
            <View style={styles.row}>
              <ThemedText themeColor="textSecondary" style={styles.label}>
                {comparison.label}
              </ThemedText>
              {comparison.percentage === null ? (
                <ThemedText themeColor="textSecondary">—</ThemedText>
              ) : (
                <View style={styles.comparisonValue}>
                  <PrivacyValue
                    style={[
                      styles.amount,
                      { color: comparison.percentage > 0 ? theme.income : theme.expense },
                    ]}>
                    {`${comparison.percentage > 0 ? '+' : '-'}${Math.abs(comparison.percentage).toFixed(2)}%`}
                  </PrivacyValue>
                  <PrivacyValue themeColor="textSecondary" style={styles.reference}>
                    {`(${comparison.referenceValue < 0 ? '-' : ''}${formatCurrency(Math.abs(comparison.referenceValue), 'EUR')})`}
                  </PrivacyValue>
                </View>
              )}
            </View>
          ) : null}

          <CollapsibleTotal
            label="Income"
            total={summary.incomeTotal}
            color={theme.income}
            categories={summary.incomeCategories}
            open={incomeOpen}
            onToggle={() => setIncomeOpen((value) => !value)}
          />
          <CollapsibleTotal
            label="Expenses"
            total={summary.expenseTotal}
            color={theme.expense}
            categories={summary.expenseCategories}
            open={expensesOpen}
            onToggle={() => setExpensesOpen((value) => !value)}
          />

          {summary.hiddenExpenseTotal > 0 ? (
            <View style={styles.row}>
              <View style={styles.labelWithIcon}>
                <SymbolView name="eye.slash" size={12} tintColor={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.label}>
                  Hidden
                </ThemedText>
              </View>
              <PrivacyValue themeColor="textSecondary" style={styles.amount}>
                {formatCurrency(summary.hiddenExpenseTotal, 'EUR')}
              </PrivacyValue>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type CollapsibleTotalProps = {
  label: string;
  total: number;
  color: string;
  categories: CategoryTotal[];
  open: boolean;
  onToggle: () => void;
};

function CollapsibleTotal({ label, total, color, categories, open, onToggle }: CollapsibleTotalProps) {
  const theme = useTheme();
  const canOpen = categories.length > 0;

  return (
    <>
      <Pressable
        onPress={canOpen ? onToggle : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? 'button' : undefined}
        accessibilityState={{ expanded: open }}
        style={styles.row}>
        <View style={styles.labelWithIcon}>
          {canOpen ? (
            <SymbolView
              name={open ? 'chevron.down' : 'chevron.right'}
              size={10}
              tintColor={theme.textSecondary}
            />
          ) : (
            <View style={styles.chevronSpacer} />
          )}
          <ThemedText style={styles.label}>{label}</ThemedText>
        </View>
        <PrivacyValue style={[styles.amount, { color }]}>{formatCurrency(total, 'EUR')}</PrivacyValue>
      </Pressable>

      {open
        ? categories.map(({ category, total: categoryTotal }) => (
            <View key={category} style={[styles.row, styles.subRow]}>
              <View style={styles.labelWithIcon}>
                <View style={styles.chevronSpacer} />
                <SymbolView name={symbolForCategory(category)} size={14} tintColor={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.subLabel} numberOfLines={1}>
                  {category}
                </ThemedText>
              </View>
              <PrivacyValue style={[styles.subAmount, { color }]}>
                {formatCurrency(categoryTotal, 'EUR')}
              </PrivacyValue>
            </View>
          ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  split: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  splitAmount: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  body: {
    paddingTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  subRow: {
    paddingVertical: Spacing.one,
  },
  labelWithIcon: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  chevronSpacer: {
    width: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  subLabel: {
    flex: 1,
    fontSize: 13,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  subAmount: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  comparisonValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  reference: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
