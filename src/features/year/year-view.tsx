import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ChipStrip } from '@/components/chip-strip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { ViewTabs } from '@/features/transactions/components/view-tabs';
import {
  findYearIndex,
  useAvailableYears,
} from '@/features/year/use-available-years';
import { useYearTransactions } from '@/features/year/use-year-transactions';
import {
  formatMonthRange,
  getDifferenceFromPreviousYear,
  getMonthlyAverage,
  percentageChange,
} from '@/features/year/year-summary';
import { useTheme } from '@/hooks/use-theme';

type YearViewProps = {
  year: number;
  onSelectYear: (year: number) => void;
};

/**
 * A year in summary.
 *
 * Only months that have finished are counted, and the previous year is measured
 * over the same span — a year in progress compared against a whole one would
 * always look worse, which tells the user nothing.
 */
export function YearView({ year, onSelectYear }: YearViewProps) {
  const theme = useTheme();
  const router = useRouter();
  const years = useAvailableYears();
  const { totals, previousTotals, lastCompleteMonthIndex, monthsCovered, isLoading, isError, refresh } =
    useYearTransactions(year);

  const selectedIndex = findYearIndex(years, year);
  const balance = totals.incomeTotal - totals.expenseTotal;
  const previousBalance = previousTotals.incomeTotal - previousTotals.expenseTotal;

  const now = new Date();
  const isCurrentYear = year === now.getFullYear();

  return (
    <Screen>
      <View style={styles.viewTabs}>
        <ViewTabs value="year" onChange={(next) => next === 'month' && router.back()} />
      </View>

      <View style={styles.strip}>
        <ChipStrip
          items={years}
          selectedIndex={selectedIndex}
          accessibilityLabel="Year"
          onSelect={(index) => {
            const option = years[index];
            if (option) onSelectYear(option.year);
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : isError ? (
          <Card>
            <ThemedText themeColor="destructive" style={styles.message}>
              Couldn’t load this year.
            </ThemedText>
          </Card>
        ) : lastCompleteMonthIndex < 0 ? (
          <Card>
            <ThemedText themeColor="textSecondary" style={styles.message}>
              {isCurrentYear
                ? 'No complete months yet this year.'
                : 'Nothing to summarise for this year.'}
            </ThemedText>
          </Card>
        ) : (
          <>
            <Card>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>
                  {isCurrentYear ? formatMonthRange(lastCompleteMonthIndex) : 'Full year'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.monthsCovered}>
                  {monthsCovered} {monthsCovered === 1 ? 'month' : 'months'}
                </ThemedText>
              </View>

              <SummaryRow
                label="Income"
                total={totals.incomeTotal}
                previousTotal={previousTotals.incomeTotal}
                months={monthsCovered}
                color={theme.income}
              />
              <SummaryRow
                label="Expenses"
                total={totals.expenseTotal}
                previousTotal={previousTotals.expenseTotal}
                months={monthsCovered}
                color={theme.expense}
              />

              <View style={[styles.divider, { backgroundColor: theme.separator }]} />

              <SummaryRow
                label="Balance"
                total={balance}
                previousTotal={previousBalance}
                months={monthsCovered}
                color={balance >= 0 ? theme.income : theme.expense}
                emphasise
              />

              {totals.hiddenExpenseTotal > 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.hiddenNote}>
                  {formatCurrency(totals.hiddenExpenseTotal, 'EUR')} in expenses is excluded from
                  these totals.
                </ThemedText>
              ) : null}
            </Card>

            <CategoryBreakdown totals={totals} previousTotals={previousTotals} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** A labelled row: the total, its monthly average, and the change. */
function SummaryRow({
  label,
  total,
  previousTotal,
  months,
  color,
  emphasise,
}: {
  label: string;
  total: number;
  previousTotal: number;
  months: number;
  color: string;
  emphasise?: boolean;
}) {
  const theme = useTheme();
  const average = getMonthlyAverage(total, months);
  const change = getDifferenceFromPreviousYear(total, previousTotal, months);
  const percent = percentageChange(average, getMonthlyAverage(previousTotal, months));

  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLabel}>
        <ThemedText themeColor={emphasise ? 'text' : 'textSecondary'} style={styles.rowLabel}>
          {label}
        </ThemedText>
        <PrivacyValue
          themeColor="textSecondary"
          style={styles.average}
          // One string: `PrivacyValue` takes a single child, and two adjacent
          // ones — the figure and the unit — arrive as an array.
          children={`${formatCurrency(average, 'EUR')}/mo`}
        />
      </View>

      <View style={styles.summaryAmounts}>
        <PrivacyValue style={[styles.total, { color }]} numberOfLines={1}>
          {formatCurrency(total, 'EUR')}
        </PrivacyValue>
        <ChangeLabel change={change} percent={percent} />
      </View>
    </View>
  );
}

/**
 * The change against the previous year.
 *
 * Below a euro a month the difference is noise, so it shows as a dash — as does
 * a comparison with no baseline.
 */
function ChangeLabel({ change, percent }: { change: number; percent: number | null }) {
  const theme = useTheme();

  if (percent === null || Math.abs(change) < 1) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.change}>
        —
      </ThemedText>
    );
  }

  // One string rather than nested text: the amount and the unit share a colour,
  // and a nested `ThemedText` would need its own style cascade to say so.
  const rising = change > 0;
  return (
    <ThemedText
      style={[styles.change, { color: rising ? theme.income : theme.expense }]}
      numberOfLines={1}>
      {`${rising ? '+' : ''}${change.toFixed(0)}/mo`}
    </ThemedText>
  );
}

/** Every category that had spending or income, richest first. */
function CategoryBreakdown({
  totals,
  previousTotals,
}: {
  totals: ReturnType<typeof useYearTransactions>['totals'];
  previousTotals: ReturnType<typeof useYearTransactions>['totals'];
}) {
  const theme = useTheme();

  const income = Object.entries(totals.incomeCategoryTotals).sort(([, a], [, b]) => b - a);
  const expense = Object.entries(totals.expenseCategoryTotals).sort(([, a], [, b]) => b - a);

  if (income.length === 0 && expense.length === 0) return null;

  return (
    <Card>
      <ThemedText style={styles.cardTitle}>By category</ThemedText>

      {income.map(([category, total]) => (
        <CategoryRow
          key={category}
          category={category}
          total={total}
          previous={previousTotals.incomeCategoryTotals[category] ?? 0}
          color={theme.income}
        />
      ))}

      {expense.map(([category, total]) => (
        <CategoryRow
          key={category}
          category={category}
          total={total}
          previous={previousTotals.expenseCategoryTotals[category] ?? 0}
          color={theme.expense}
        />
      ))}
    </Card>
  );
}

function CategoryRow({
  category,
  total,
  previous,
  color,
}: {
  category: string;
  total: number;
  previous: number;
  color: string;
}) {
  const theme = useTheme();
  const percent = percentageChange(total, previous);

  return (
    <View style={styles.categoryRow}>
      <ThemedText style={styles.rowLabel} numberOfLines={1}>
        {category}
      </ThemedText>

      <View style={styles.categoryAmounts}>
        <PrivacyValue style={[styles.categoryTotal, { color }]} numberOfLines={1}>
          {formatCurrency(total, 'EUR')}
        </PrivacyValue>

        {percent !== null && Math.abs(percent) >= 1 ? (
          <ThemedText
            themeColor="textSecondary"
            style={styles.categoryChange}
            numberOfLines={1}>
            {percent > 0 ? '+' : ''}
            {percent.toFixed(0)}%
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>;
}

const styles = StyleSheet.create({
  viewTabs: {
    paddingTop: Spacing.two,
  },
  strip: {
    paddingVertical: Spacing.two,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  loading: {
    marginTop: Spacing.five,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  monthsCovered: {
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  summaryLabel: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  average: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  summaryAmounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  total: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  hiddenNote: {
    fontSize: 12,
    marginTop: Spacing.two,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  categoryAmounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  categoryTotal: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  categoryChange: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
