import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import {
  AddTransactionButton,
  ScrollToTopButton
} from '@/components/floating-buttons';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import { ActivityControls } from '@/features/transactions/components/activity-controls';
import { DayHeader } from '@/features/transactions/components/day-header';
import { MonthStrip } from '@/features/transactions/components/month-strip';
import { MonthSummaryCard } from '@/features/transactions/components/month-summary-card';
import type { DayGroup } from '@/features/transactions/group-by-day';
import { usePrefetchAdjacentMonths } from '@/features/transactions/use-adjacent-prefetch';
import {
  findMonthIndex,
  useAvailableMonths,
  type MonthOption,
} from '@/features/transactions/use-available-months';
import { useMonthSummary } from '@/features/transactions/use-month-summary';
import { useMonthTransactions } from '@/features/transactions/use-month-transactions';
import { TX } from '@/lib/query-keys';
import { useTransactionRowNavigation } from '@/features/transactions/use-transaction-rows';

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
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  const { months } = useAvailableMonths();
  const { days, transactions, isLoading, isError, error, refresh: refreshMonth } =
    useMonthTransactions(year, month);

  /**
   * Pull-to-refresh. The list refetches its own split sources, but the summary
   * keeps them in separate queries, so without this a new split slice would
   * reach the list and Home's SQL figures but not the summary's split badge.
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      refreshMonth(),
      queryClient.invalidateQueries({ queryKey: [TX, 'split-sources'] }),
    ]);
  }, [refreshMonth, queryClient]);

  usePrefetchAdjacentMonths(year, month, !isLoading && !isError);

  const summary = useMonthSummary(year, month, transactions);

  const selectedIndex = findMonthIndex(months, year, month);

  // SectionList wants each section to carry its own `data`, so the day's totals
  // and its transactions are flattened into one object.
  const sections = useMemo(() => days.map((day) => ({ ...day, data: day.transactions })), [days]);

  const listRef = useRef<SectionList<Transaction, DayGroup>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(event.nativeEvent.contentOffset.y > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
  }, []);

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
      <ScreenHeader title="Activity" />

      <View style={styles.viewTabs}>
        <ActivityControls
          value="month"
          onChange={(next) => {
            if (next === 'year') {
              router.push('/transactions/year');
              return;
            }
            // Tapping the active Month tab returns to the current month.
            const now = new Date();
            router.setParams({
              year: String(now.getFullYear()),
              month: String(now.getMonth() + 1),
            });
          }}
        />
      </View>

      <View style={styles.strip}>
        <MonthStrip months={months} selectedIndex={selectedIndex} onSelect={handleSelectMonth} />
      </View>

      {isLoading && days.length === 0 ? (
        <SkeletonRows count={3} />
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // On iOS this defaults to true, which is what pins the day headers
          // while their transactions scroll past.
          stickySectionHeadersEnabled
          ListHeaderComponent={
            summary && !isError ? (
              <MonthSummaryCard summary={summary} year={year} month={month} />
            ) : null
          }
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          ListEmptyComponent={
            isError ? (
              <EmptyState
                title="Couldn’t load this month"
                detail={error instanceof Error ? error.message : 'Unknown error'}
              />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {`No transactions in ${new Date(year, month - 1, 1).toLocaleDateString(
                  'en-GB',
                  { month: 'long' },
                )}`}
              </ThemedText>
            )
          }
          contentContainerStyle={[
            styles.listContent,
            {
              // The add button floats over the end of the list, so the last row
              // stops just above it rather than leaving an extra gap.
              paddingBottom: insets.bottom,
            },
          ]}
        />
      )}

      {showScrollTop ? <ScrollToTopButton onPress={scrollToTop} /> : null}
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
  viewTabs: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  strip: {
    paddingVertical: Spacing.two,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
    fontSize: 13,
  },
});
