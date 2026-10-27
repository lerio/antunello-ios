import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Filter } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AddTransactionButton } from '@/components/floating-buttons';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import { FilterSheet } from '@/features/filter/components/filter-sheet';
import {
  hasAnyFilter,
  initialFilterCriteria,
  type FilterCriteria,
} from '@/features/filter/filter-criteria';
import { useFilteredTransactions } from '@/features/filter/use-filtered-transactions';
import { SearchSummary } from '@/features/search/components/search-summary';
import { DayHeader } from '@/features/transactions/components/day-header';
import { useTransactionRowNavigation } from '@/features/transactions/use-transaction-rows';
import { groupTransactionsByDay, type DayGroup } from '@/features/transactions/group-by-day';
import { useTheme } from '@/hooks/use-theme';

/**
 * Search and filter across every transaction.
 *
 * One screen rather than two: the search field is the primary input and the
 * filter button opens the filter sheet over the same results. Search text and
 * criteria are sent to one query, so the results always reflect both.
 *
 * Unlike the month and year views, these results are the raw stored rows —
 * split sources appear once, not as their monthly slices.
 */
export function SearchView() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ filters?: string }>();
  const initialFiltersOpen = params.filters === '1';
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<FilterCriteria>(initialFilterCriteria);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(initialFiltersOpen);

  const hasSearch = query.trim().length > 0;
  const enabled = hasSearch || hasInteracted;

  const { results, truncated, isLoading, isError, error, refresh } =
    useFilteredTransactions(criteria, enabled, query);

  const handleChange = useCallback((next: FilterCriteria) => {
    setCriteria(next);
    setHasInteracted(hasAnyFilter(next));
  }, []);

  const openSheet = useCallback(() => {
    inputRef.current?.blur();
    setSheetOpen(true);
  }, []);

  const sections = useMemo(
    () => groupTransactionsByDay(results).map((day) => ({ ...day, data: day.transactions })),
    [results],
  );

  const { renderItem } = useTransactionRowNavigation();

  const showYear = criteria.year === null;
  const renderSectionHeader = useCallback(
    ({ section }: { section: DayGroup }) => <DayHeader day={section} showYear={showYear} />,
    [showYear],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const filtersActive = hasAnyFilter(criteria);

  return (
    <Screen>
      <View style={styles.searchRow}>
        <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search transactions"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            autoFocus={!initialFiltersOpen}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search transactions"
          />
        </View>

        <Pressable
          onPress={openSheet}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Filter size={18} color={theme.tint} />
          {filtersActive ? (
            <View style={[styles.filterDot, { backgroundColor: theme.tint }]} />
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel search">
          <ThemedText themeColor="tint" style={styles.cancel}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onRefresh={refresh}
        refreshing={false}
        ListHeaderComponent={
          results.length > 0 ? (
            <View>
              <SearchSummary transactions={results} />
              {truncated ? <TruncatedNotice /> : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <SearchPlaceholder
            enabled={enabled}
            hasSearch={hasSearch}
            isLoading={isLoading}
            isError={isError}
            error={error}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <AddTransactionButton onPress={() => router.push('/transaction/new')} />

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
 * What the list shows when it has no rows.
 *
 * The states are mutually exclusive and each says something different about why
 * the screen is empty, so they are resolved in one place.
 */
function SearchPlaceholder({
  enabled,
  hasSearch,
  isLoading,
  isError,
  error,
}: {
  enabled: boolean;
  hasSearch: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  if (isError) {
    return (
      <EmptyState
        title="Couldn’t load transactions"
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

  if (!enabled) {
    return (
      <EmptyState
        title="Search transactions"
        detail="Type a search or adjust filters to see results."
      />
    );
  }

  return (
    <EmptyState
      title="No transactions found"
      detail={
        hasSearch
          ? 'Try a different search or adjust the filters.'
          : 'No transactions match the current filters.'
      }
    />
  );
}

/** Says when the 500-row cap makes the results partial. */
function TruncatedNotice() {
  const theme = useTheme();

  return (
    <View style={[styles.notice, { borderColor: theme.separator }]}>
      <SymbolView name="exclamationmark.triangle" size={12} tintColor={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.noticeText}>
        Showing the 500 most recent matches. Narrow the search or filters.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    height: 36,
    borderRadius: Radius.small + 2,
  },
  input: {
    flex: 1,
    fontSize: 17,
    padding: 0,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cancel: {
    fontSize: 17,
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
  },
});
