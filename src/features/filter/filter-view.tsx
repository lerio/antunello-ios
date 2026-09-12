import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import {
  hasAnyFilter,
  initialFilterCriteria,
  isAllTime,
  type FilterCriteria,
} from '@/features/filter/filter-criteria';
import { FilterSheet } from '@/features/filter/components/filter-sheet';
import { useFilteredTransactions } from '@/features/filter/use-filtered-transactions';
import { SearchSummary } from '@/features/search/components/search-summary';
import { DayHeader } from '@/features/transactions/components/day-header';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { groupTransactionsByDay, type DayGroup } from '@/features/transactions/group-by-day';
import { isOptimisticId } from '@/features/transactions/mutations';
import { useTheme } from '@/hooks/use-theme';

/**
 * Transactions matching a set of filters.
 *
 * The criteria live in this screen's state rather than in route params. Unlike
 * the month view — where the month is a place the user navigates between and
 * should come back to — a filter is assembled in the moment, and a back gesture
 * leaving the screen is what discards it.
 */
export function FilterView() {
  const router = useRouter();
  const theme = useTheme();

  const [criteria, setCriteria] = useState<FilterCriteria>(initialFilterCriteria);
  // The results stay blank until a control is touched: an untouched filter
  // screen listing every transaction ever recorded is not a useful starting
  // point, and would hide the fact that nothing is being filtered.
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);

  const { results, truncated, isLoading, isError, error, refresh } =
    useFilteredTransactions(criteria, hasInteracted);

  const sections = useMemo(
    () => groupTransactionsByDay(results).map((day) => ({ ...day, data: day.transactions })),
    [results],
  );

  const handleChange = useCallback((next: FilterCriteria) => {
    setCriteria(next);
    setHasInteracted(true);
  }, []);

  const handlePressTransaction = useCallback(
    (transaction: Transaction) => {
      if (isOptimisticId(transaction.id)) return;
      router.push(`/transaction/${transaction.id}`);
    },
    [router],
  );

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

  // Only an all-time filter mixes years, so only then does the header need one.
  const showYear = isAllTime(criteria);
  const renderSectionHeader = useCallback(
    ({ section }: { section: DayGroup }) => <DayHeader day={section} showYear={showYear} />,
    [showYear],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to transactions">
          <SymbolView name="chevron.left" size={20} tintColor={theme.tint} />
        </Pressable>

        <ThemedText style={styles.barTitle}>Filter</ThemedText>

        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit filters"
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <SymbolView name="line.3.horizontal.decrease" size={14} tintColor={theme.text} />
          <ThemedText style={styles.filterButtonLabel}>Filters</ThemedText>
          {hasAnyFilter(criteria) ? (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <ThemedText style={styles.badgeLabel}>{countActive(criteria)}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        onRefresh={refresh}
        refreshing={false}
        ListHeaderComponent={
          results.length > 0 ? (
            <View>
              <SearchSummary transactions={results} />
              {truncated ? <TruncationNotice /> : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <FilterPlaceholder
            hasInteracted={hasInteracted}
            isLoading={isLoading}
            isError={isError}
            error={error}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <FilterSheet
        visible={isSheetOpen}
        criteria={criteria}
        onChange={handleChange}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

/**
 * How many filters are active, for the badge.
 *
 * The period counts as one however it is set, since a year and a month together
 * are a single narrowing rather than two.
 */
function countActive(criteria: FilterCriteria): number {
  let count = 0;
  if (criteria.types.length > 0) count += 1;
  if (criteria.mainCategories.length > 0) count += 1;
  if (criteria.subCategories.length > 0) count += 1;
  if (criteria.fundSourceIds.length > 0) count += 1;
  if (criteria.currencies.length > 0) count += 1;
  if (criteria.amountMin !== null || criteria.amountMax !== null) count += 1;
  if (criteria.year !== null || criteria.month !== null) count += 1;
  return count;
}

/**
 * Says when the list is not everything that matched.
 *
 * The query stops at 500 rows, as the web app's does. Without this the summary
 * card would present a balance over a truncated set as though it were the whole
 * picture — which is the part of the upstream behaviour worth not copying.
 */
function TruncationNotice() {
  const theme = useTheme();

  return (
    <View style={[styles.notice, { borderColor: theme.separator }]}>
      <SymbolView name="exclamationmark.triangle" size={12} tintColor={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.noticeText}>
        Showing the 500 most recent matches. Narrow the filters to see the rest.
      </ThemedText>
    </View>
  );
}

function FilterPlaceholder({
  hasInteracted,
  isLoading,
  isError,
  error,
}: {
  hasInteracted: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  if (!hasInteracted) {
    return (
      <EmptyState title="Filter transactions" detail="Adjust filters to see transactions." />
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn’t filter"
        detail={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return <EmptyState title="No matches" detail="No transactions match the current filters." />;
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  barTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    height: 34,
    borderRadius: Radius.small + 4,
  },
  filterButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.five,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
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
