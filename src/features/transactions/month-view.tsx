import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { AddTransactionButton } from '@/components/add-transaction-button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SkeletonRows } from '@/components/skeleton';
import { Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import { DayHeader } from '@/features/transactions/components/day-header';
import { useTransactionRowNavigation } from '@/features/transactions/use-transaction-rows';
import { ListToolbar } from '@/features/transactions/components/list-toolbar';
import { MonthStrip } from '@/features/transactions/components/month-strip';
import { ViewTabs } from '@/features/transactions/components/view-tabs';
import type { DayGroup } from '@/features/transactions/group-by-day';
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

  const { renderItem } = useTransactionRowNavigation();

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
});
