import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { formatDateHeader } from '@/domain/date';
import type { Transaction } from '@/domain/types';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { MonthStrip } from '@/features/transactions/components/month-strip';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import type { DayGroup } from '@/features/transactions/group-by-day';
import { useMonthTransactions } from '@/features/transactions/use-month-transactions';
import {
  findMonthIndex,
  useAvailableMonths,
  type MonthOption,
} from '@/features/transactions/use-available-months';
import { useTheme } from '@/hooks/use-theme';

/**
 * The month's transactions.
 *
 * The selected period lives in route params rather than component state, which
 * is what makes back-navigation restore the month the user was looking at. It
 * also mirrors the web app, where the same values live in the query string.
 */
export function MonthView() {
  const { year, month } = usePeriodParams();
  const router = useRouter();

  const { months } = useAvailableMonths();
  const { days, isLoading, isError, error, refresh } = useMonthTransactions(year, month);

  const selectedIndex = findMonthIndex(months, year, month);

  // SectionList wants each section to carry its own `data`, so the day's totals
  // and its transactions are flattened into one object.
  const sections = useMemo(() => days.map((day) => ({ ...day, data: day.transactions })), [days]);

  const handleSelectMonth = useCallback(
    (option: MonthOption) => {
      router.setParams({ year: String(option.year), month: String(option.month) });
    },
    [router],
  );

  const handlePressTransaction = useCallback((_transaction: Transaction) => {
    // Editing arrives with the transaction form; the row is already wired for it.
  }, []);

  return (
    <Screen>
      <View style={styles.strip}>
        <MonthStrip months={months} selectedIndex={selectedIndex} onSelect={handleSelectMonth} />
      </View>

      {isLoading && days.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} onPress={handlePressTransaction} />
          )}
          renderSectionHeader={({ section }) => <DayHeader day={section} />}
          // On iOS this defaults to true, which is what pins the day headers
          // while their transactions scroll past.
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          ListEmptyComponent={
            isError ? (
              <EmptyState
                title="Couldn’t load this month"
                detail={error instanceof Error ? error.message : 'Unknown error'}
              />
            ) : (
              <EmptyState title="Nothing here" detail="No transactions in this month." />
            )
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
}

/** Reads the selected period from route params, defaulting to the current month. */
function usePeriodParams() {
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const now = new Date();

  const parsedYear = Number(params.year);
  const parsedMonth = Number(params.month);

  const year = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
  const month =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;

  return { year, month };
}

/**
 * A sticky day header: the date on the left, the day's totals on the right.
 *
 * Both totals are always covered by privacy mode — unlike a transaction row,
 * where only income is hidden. A day total is an aggregate, so leaving it
 * readable would leak the sum of the very values being hidden.
 */
function DayHeader({ day }: { day: DayGroup }) {
  const theme = useTheme();
  const isPositive = day.dailyTotal >= 0;

  return (
    <View
      style={[
        styles.dayHeader,
        { backgroundColor: theme.background, borderBottomColor: theme.separator },
      ]}>
      <View style={styles.dayHeaderSide}>
        <ThemedText themeColor="textSecondary" style={styles.dayLabel}>
          {formatDateHeader(day.isoDate)}
        </ThemedText>
        {day.hiddenCount > 0 ? (
          <SymbolView name="eye.slash" size={12} tintColor={theme.textSecondary} />
        ) : null}
      </View>

      <View style={[styles.dayHeaderSide, styles.dayHeaderTotals]}>
        <PrivacyValue
          style={[styles.dayTotal, { color: isPositive ? theme.income : theme.expense }]}
          numberOfLines={1}>
          {formatCurrency(Math.abs(day.dailyTotal), 'EUR')}
        </PrivacyValue>

        {day.dailySplitTotal !== 0 ? (
          <View style={styles.splitTotal}>
            <SymbolView
              name="arrow.triangle.branch"
              size={11}
              tintColor={theme.textSecondary}
            />
            <PrivacyValue
              themeColor="textSecondary"
              style={styles.daySplit}
              numberOfLines={1}>
              {formatCurrency(Math.abs(day.dailySplitTotal), 'EUR')}
            </PrivacyValue>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyDetail}>
        {detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingVertical: Spacing.two,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.five,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayHeaderSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dayHeaderTotals: {
    flexShrink: 1,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  splitTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  daySplit: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyDetail: {
    textAlign: 'center',
  },
});
