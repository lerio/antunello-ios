import { SymbolView } from 'expo-symbols';
import { EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryGlyph } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import type { CategoryTotal, MonthSummary } from '@/features/transactions/month-summary';
import { useTheme } from '@/hooks/use-theme';

type MonthSummaryCardProps = {
  summary: MonthSummary;
  year: number;
  month: number;
};

/** `Net · This month` for the current month, `Net · October` otherwise. */
function periodTitle(year: number, month: number): string {
  const now = new Date();
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    return 'Net · This month';
  }
  const name = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
  });
  return `Net · ${name}`;
}

/**
 * The month's net result, collapsed by default.
 *
 * The hero is income minus expenses, signed and coloured by sign; the split
 * total and its not-yet-visible remainder sit under it in the home card's
 * row style. Expanding reveals the previous-month comparison, then Income and
 * Expenses (each expandable into categories) and the hidden total. Every figure
 * is an aggregate, so privacy mode covers all of them.
 */
export function MonthSummaryCard({ summary, year, month }: MonthSummaryCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);

  const tone =
    summary.balance < 0
      ? theme.expense
      : summary.balance > 0
        ? theme.income
        : theme.textSecondary;
  // The colour carries the sign; the figure itself is always the magnitude.
  const signedBalance = formatCurrency(Math.abs(summary.balance), 'EUR');
  const { comparison } = summary;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <View style={styles.header}>
        <ThemedText themeColor="textSecondary" style={styles.label} numberOfLines={1}>
          {periodTitle(year, month)}
        </ThemedText>
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Collapse summary' : 'Expand summary'}
          style={styles.toggle}>
          <SymbolView
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={13}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.heroRow}>
        <PrivacyValue style={[styles.hero, { color: tone }]} numberOfLines={1}>
          {signedBalance}
        </PrivacyValue>
      </View>

      {summary.totalSplitAmountEur > 0 ? (
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <ThemedText themeColor="textSecondary" style={styles.breakdownLabel}>
              Total split
            </ThemedText>
            <PrivacyValue style={styles.breakdownValue}>
              {formatCurrency(summary.totalSplitAmountEur, 'EUR')}
            </PrivacyValue>
          </View>
          {summary.expectedSplitAmountEur > 0 ? (
            <View style={styles.breakdownRow}>
              <ThemedText themeColor="textSecondary" style={styles.breakdownLabel}>
                Remaining
              </ThemedText>
              <PrivacyValue style={styles.breakdownValue}>
                {formatCurrency(summary.expectedSplitAmountEur, 'EUR')}
              </PrivacyValue>
            </View>
          ) : null}
        </View>
      ) : null}

      {expanded ? (
        <View style={[styles.body, { borderTopColor: theme.separator }]}>
          {comparison ? (
            <View style={styles.comparisonRow}>
              <ThemedText themeColor="textSecondary" style={styles.comparisonLabel}>
                {comparison.label}
              </ThemedText>
              {comparison.percentage === null ? (
                <ThemedText themeColor="textSecondary">—</ThemedText>
              ) : (
                <View style={styles.comparisonValue}>
                  <PrivacyValue
                    style={[
                      styles.comparisonPercent,
                      {
                        color:
                          comparison.percentage > 0
                            ? theme.income
                            : comparison.percentage < 0
                              ? theme.expense
                              : theme.textSecondary,
                      },
                    ]}>
                    {`${comparison.percentage > 0 ? '+' : comparison.percentage < 0 ? '-' : ''}${Math.abs(
                      comparison.percentage,
                    ).toFixed(2)}%`}
                  </PrivacyValue>
                  <PrivacyValue themeColor="textSecondary" style={styles.comparisonReference}>
                    {`(${comparison.referenceValue < 0 ? '-' : ''}${formatCurrency(
                      Math.abs(comparison.referenceValue),
                      'EUR',
                    )})`}
                  </PrivacyValue>
                </View>
              )}
            </View>
          ) : null}

          <CollapsibleTotal
            label="Income"
            total={summary.incomeTotal}
            type="income"
            categories={summary.incomeCategories}
            open={incomeOpen}
            onToggle={() => setIncomeOpen((value) => !value)}
          />
          <CollapsibleTotal
            label="Expenses"
            total={summary.expenseTotal}
            type="expense"
            categories={summary.expenseCategories}
            open={expensesOpen}
            onToggle={() => setExpensesOpen((value) => !value)}
          />

          {summary.hiddenExpenseTotal > 0 ? (
            <View style={styles.groupRow}>
              <View style={styles.leading}>
                <EyeOff size={14} color={theme.textSecondary} strokeWidth={2} />
              </View>
              <ThemedText themeColor="textSecondary" style={styles.categoryLabel}>
                Hidden
              </ThemedText>
              <PrivacyValue themeColor="textSecondary" style={styles.categoryAmount}>
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
  type: 'income' | 'expense';
  categories: CategoryTotal[];
  open: boolean;
  onToggle: () => void;
};

function CollapsibleTotal({
  label,
  total,
  type,
  categories,
  open,
  onToggle,
}: CollapsibleTotalProps) {
  const theme = useTheme();
  const canOpen = categories.length > 0;
  const isIncome = type === 'income';

  return (
    <>
      <Pressable
        onPress={canOpen ? onToggle : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? 'button' : undefined}
        accessibilityState={{ expanded: open }}
        style={styles.groupRow}>
        <View style={styles.leading} />
        <ThemedText style={styles.groupLabel}>{label}</ThemedText>
        {canOpen ? (
          <SymbolView
            name={open ? 'chevron.up' : 'chevron.down'}
            size={10}
            tintColor={theme.textSecondary}
          />
        ) : null}
        <View style={styles.spacer} />
        <PrivacyValue
          style={[
            styles.groupAmount,
            { color: isIncome ? theme.income : theme.expense },
          ]}>
          {`${isIncome ? '+' : ''}${formatCurrency(total, 'EUR')}`}
        </PrivacyValue>
      </Pressable>

      {open
        ? categories.map(({ category, total: categoryTotal }) => (
            <View key={category} style={styles.categoryRow}>
              <View style={[styles.leading, styles.categoryIcon, { backgroundColor: theme.backgroundElement }]}>
                <CategoryGlyph
                  category={category}
                  size={14}
                  color={theme.textSecondary}
                />
              </View>
              <ThemedText style={styles.categoryLabel} numberOfLines={1}>
                {category}
              </ThemedText>
              <PrivacyValue
                style={[
                  styles.categoryAmount,
                  { color: isIncome ? theme.income : theme.expense },
                ]}>
                {`${isIncome ? '+' : ''}${formatCurrency(categoryTotal, 'EUR')}`}
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
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  toggle: {
    padding: Spacing.two,
  },
  breakdown: {
    gap: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  hero: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  body: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  comparisonLabel: {
    fontSize: 12,
  },
  comparisonValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  comparisonPercent: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  comparisonReference: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  leading: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    borderRadius: 12,
  },
  groupLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  groupAmount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  categoryAmount: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
