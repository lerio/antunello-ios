import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { AddTransactionButton } from '@/components/add-transaction-button';
import { Screen } from '@/components/screen';
import { SkeletonRows } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import { DayHeader } from '@/features/transactions/components/day-header';
import { ListToolbar } from '@/features/transactions/components/list-toolbar';
import { MonthStrip } from '@/features/transactions/components/month-strip';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { ViewTabs } from '@/features/transactions/components/view-tabs';
import type { DayGroup } from '@/features/transactions/group-by-day';
import { isOptimisticId } from '@/features/transactions/mutations';
import { useMonthTransactions } from '@/features/transactions/use-month-transactions';
import {
  findMonthIndex,
  useAvailableMonths,
  type MonthOption,
} from '@/features/transactions/use-available-months';

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

  const handlePressTransaction = useCallback(
    (transaction: Transaction) => {
      // A row that is still saving carries only a placeholder id, so there is
      // no record to open yet. Brief in practice — it is replaced by the real
      // row as soon as the insert returns.
      if (isOptimisticId(transaction.id)) return;
      router.push(`/transaction/${transaction.id}`);
    },
    [router],
  );

  // Stable identities, so a re-render of this screen does not make the list
  // treat every row as changed. Passing a fresh closure each render was causing
  // the whole month to re-render, which on a long month is visible as a stall.
  const handleCategoryPress = useCallback(
    (category: string) => {
      router.push(`/transactions/category/${encodeURIComponent(category)}`);
    },
    [router],
  );

  const handleSubCategoryPress = useCallback(
    (category: string, subCategory: string) => {
      router.push(
        `/transactions/category/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`,
      );
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow
        transaction={item}
        onPress={handlePressTransaction}
        onCategoryPress={handleCategoryPress}
        onSubCategoryPress={handleSubCategoryPress}
      />
    ),
    [handlePressTransaction, handleCategoryPress, handleSubCategoryPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DayGroup }) => <DayHeader day={section} />,
    [],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <Screen>
      <View style={styles.toolbar}>
        <ListToolbar />
      </View>

      <View style={styles.viewTabs}>
        <ViewTabs value="month" onChange={(next) => next === 'year' && router.push('/transactions/year')} />
      </View>

      <View style={styles.strip}>
        <MonthStrip months={months} selectedIndex={selectedIndex} onSelect={handleSelectMonth} />
      </View>

      {isLoading && days.length === 0 ? (
        <SkeletonRows count={8} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
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

      <AddTransactionButton onPress={() => router.push('/transaction/new')} />
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
  toolbar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  viewTabs: {
    paddingTop: Spacing.two,
  },
  strip: {
    paddingVertical: Spacing.two,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.five,
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
