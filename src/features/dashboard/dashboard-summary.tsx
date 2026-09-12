import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import {
  listCategories,
  percentageChange,
  type CategoryAggregate,
  type DashboardComparison,
} from '@/features/dashboard/dashboard-totals';
import { useDashboardComparison } from '@/features/dashboard/use-dashboard-comparison';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';

/** The two-digit year each table compares against, for the `vs` heading. */
function previousYearSuffix(): string {
  const previous = new Date().getFullYear() - 1;
  // A year ending in 00 shortens to "0", which reads as a typo rather than a
  // year. The web app guards the same way.
  return String(previous).slice(-2) === '00' ? '99' : String(previous).slice(-2);
}

/**
 * The 30-day comparison.
 *
 * Two tables, mirroring the web app: a headline gains-or-losses summary, and a
 * per-category breakdown whose rows expand to their subcategories.
 *
 * Both compare the last 30 days against the 30 before them and the same 30 days
 * a year earlier.
 */
export function DashboardSummary() {
  const { comparison, isLoading, isError } = useDashboardComparison();

  if (isError) {
    return (
      <Card title="Last 30 days">
        <ThemedText themeColor="destructive" style={styles.message}>
          Couldn’t load the comparison.
        </ThemedText>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card title="Last 30 days">
        <ActivityIndicator style={styles.message} />
      </Card>
    );
  }

  return (
    <>
      <BalanceTable comparison={comparison} />
      <CategoryTable comparison={comparison} />
    </>
  );
}

/**
 * The headline table: income and expenses for each period, and the change.
 *
 * Titled "Gains" or "Losses" by whether the period ended up or down, matching
 * the web app.
 */
function BalanceTable({ comparison }: { comparison: DashboardComparison }) {
  const net = comparison.current.income - comparison.current.expense;
  const title = net >= 0 ? 'Gains (30 Days)' : 'Losses (30 Days)';

  return (
    <Card title={title}>
      <ColumnHeadings />

      <ComparisonRow
        label="Income"
        current={comparison.current.income}
        previous={comparison.previous.income}
        lastYear={comparison.lastYear.income}
        positive
      />
      <ComparisonRow
        label="Expenses"
        current={comparison.current.expense}
        previous={comparison.previous.expense}
        lastYear={comparison.lastYear.expense}
      />
    </Card>
  );
}

/**
 * The per-category table.
 *
 * Tapping a category reveals its subcategories. Only one is open at a time,
 * which keeps a long table navigable — the same accordion the web app uses.
 */
function CategoryTable({ comparison }: { comparison: DashboardComparison }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const income = listCategories(comparison, 'income');
  const expense = listCategories(comparison, 'expense');

  if (income.length === 0 && expense.length === 0) {
    return (
      <Card title="Category Breakdown (30 Days)">
        <ThemedText themeColor="textSecondary" style={styles.message}>
          Nothing in the last 30 days.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card title="Category Breakdown (30 Days)">
      <ColumnHeadings />

      {income.map((category) => (
        <CategoryRows
          key={category}
          category={category}
          aggregate={comparison.current.incomeCategories[category]}
          previous={comparison.previous.incomeCategories[category]}
          lastYear={comparison.lastYear.incomeCategories[category]}
          expanded={expanded === category}
          onToggle={() => setExpanded(expanded === category ? null : category)}
        />
      ))}

      {income.length > 0 && expense.length > 0 ? (
        <View style={styles.separator}>
          <ThemedText themeColor="textSecondary" style={styles.separatorLabel}>
            EXPENSES
          </ThemedText>
        </View>
      ) : null}

      {expense.map((category) => (
        <CategoryRows
          key={category}
          category={category}
          aggregate={comparison.current.expenseCategories[category]}
          previous={comparison.previous.expenseCategories[category]}
          lastYear={comparison.lastYear.expenseCategories[category]}
          expanded={expanded === category}
          onToggle={() => setExpanded(expanded === category ? null : category)}
        />
      ))}
    </Card>
  );
}

/** One category, and its subcategories when expanded. */
function CategoryRows({
  category,
  aggregate,
  previous,
  lastYear,
  expanded,
  onToggle,
}: {
  category: string;
  aggregate?: CategoryAggregate;
  previous?: CategoryAggregate;
  lastYear?: CategoryAggregate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const subcategories = Object.entries(aggregate?.subcategories ?? {}).sort(
    ([, a], [, b]) => b - a,
  );
  const hasSubcategories = subcategories.length > 0;

  return (
    <>
      <Pressable
        onPress={hasSubcategories ? onToggle : undefined}
        disabled={!hasSubcategories}
        accessibilityRole={hasSubcategories ? 'button' : undefined}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [
          styles.row,
          pressed && hasSubcategories ? { backgroundColor: theme.backgroundElement } : null,
        ]}>
        <View style={styles.categoryCell}>
          {hasSubcategories ? (
            <SymbolView
              name={expanded ? 'chevron.down' : 'chevron.right'}
              size={10}
              tintColor={theme.textSecondary}
            />
          ) : (
            <View style={styles.chevronSpacer} />
          )}
          <ThemedText style={styles.categoryLabel} numberOfLines={1}>
            {category}
          </ThemedText>
        </View>

        <ComparisonCells
          current={aggregate?.total ?? 0}
          previous={previous?.total ?? 0}
          lastYear={lastYear?.total ?? 0}
        />
      </Pressable>

      {expanded
        ? subcategories.map(([name, total]) => (
            <View key={name} style={[styles.row, styles.subRow]}>
              <View style={styles.categoryCell}>
                <View style={styles.chevronSpacer} />
                <ThemedText themeColor="textSecondary" style={styles.subLabel} numberOfLines={1}>
                  {name}
                </ThemedText>
              </View>

              <ComparisonCells
                current={total}
                previous={previous?.subcategories[name] ?? 0}
                lastYear={lastYear?.subcategories[name] ?? 0}
                muted
              />
            </View>
          ))
        : null}
    </>
  );
}

/** A plain labelled row with no drill-down, used for the headline table. */
function ComparisonRow({
  label,
  current,
  previous,
  lastYear,
  positive,
}: {
  label: string;
  current: number;
  previous: number;
  lastYear: number;
  positive?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.categoryCell}>
        <View style={styles.chevronSpacer} />
        <ThemedText style={styles.categoryLabel}>{label}</ThemedText>
      </View>

      <ComparisonCells
        current={current}
        previous={previous}
        lastYear={lastYear}
        colored={positive ? 'income' : 'expense'}
      />
    </View>
  );
}

/** The three figures and the change, shared by both tables' rows. */
function ComparisonCells({
  current,
  previous,
  lastYear,
  colored,
  muted,
}: {
  current: number;
  previous: number;
  lastYear: number;
  colored?: 'income' | 'expense';
  muted?: boolean;
}) {
  const theme = useTheme();
  const vsPrevious = percentageChange(current, previous);
  const vsLastYear = percentageChange(current, lastYear);

  const amountColor = !colored
    ? theme.text
    : colored === 'income'
      ? theme.income
      : theme.expense;

  return (
    <>
      <View style={styles.amountCell}>
        <PrivacyValue
          style={[styles.amount, muted && styles.mutedAmount, { color: amountColor }]}
          numberOfLines={1}>
          {formatCurrency(current, 'EUR')}
        </PrivacyValue>
      </View>

      <View style={styles.amountCell}>
        <PrivacyValue
          themeColor="textSecondary"
          style={[styles.previous, muted && styles.mutedAmount]}
          numberOfLines={1}>
          {formatCurrency(previous, 'EUR')}
        </PrivacyValue>
      </View>

      <View style={styles.changeCell}>
        <ChangeLabel value={vsPrevious} suffix="prev" />
        <ChangeLabel value={vsLastYear} suffix="yr" />
      </View>
    </>
  );
}

/**
 * A signed percentage.
 *
 * Below a percentage point the change is noise, so it renders as a dash rather
 * than "+0%" — and with no baseline to compare against there is no percentage
 * at all, which also shows as a dash.
 */
function ChangeLabel({ value, suffix }: { value: number | null; suffix: string }) {
  const theme = useTheme();

  if (value === null || Math.abs(value) < 1) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.change}>
        {suffix} —
      </ThemedText>
    );
  }

  const rising = value > 0;
  return (
    <ThemedText
      style={[styles.change, { color: rising ? theme.income : theme.expense }]}
      numberOfLines={1}>
      {suffix} {rising ? '+' : ''}
      {value.toFixed(0)}%
    </ThemedText>
  );
}

/** The column headings both tables share. */
function ColumnHeadings() {
  return (
    <View style={[styles.headings]}>
      <View style={styles.categoryCell}>
        <ThemedText themeColor="textSecondary" style={styles.headingText}>
          Category
        </ThemedText>
      </View>
      <View style={styles.amountCell}>
        <ThemedText themeColor="textSecondary" style={[styles.headingText, styles.right]}>
          Last 30
        </ThemedText>
      </View>
      <View style={styles.amountCell}>
        <ThemedText themeColor="textSecondary" style={[styles.headingText, styles.right]}>
          Previous
        </ThemedText>
      </View>
      <View style={styles.changeCell}>
        <ThemedText themeColor="textSecondary" style={[styles.headingText, styles.right]}>
          vs &rsquo;{previousYearSuffix()}
        </ThemedText>
      </View>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  headings: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.one,
  },
  headingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },
  subRow: {
    paddingVertical: Spacing.one,
  },
  categoryCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingRight: Spacing.two,
  },
  chevronSpacer: {
    width: 12,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
  },
  subLabel: {
    flex: 1,
    fontSize: 13,
  },
  amountCell: {
    width: 78,
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  mutedAmount: {
    fontSize: 13,
    fontWeight: '400',
  },
  previous: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  changeCell: {
    width: 74,
    alignItems: 'flex-end',
  },
  change: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  right: {
    textAlign: 'right',
  },
  separator: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  separatorLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    paddingVertical: Spacing.two,
  },
});
