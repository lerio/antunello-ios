import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AddTransactionButton } from '@/components/add-transaction-button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Transaction } from '@/domain/types';
import { SearchSummary } from '@/features/search/components/search-summary';
import { useTransactionSearch } from '@/features/search/use-transaction-search';
import { DayHeader } from '@/features/transactions/components/day-header';
import { useTransactionRowNavigation } from '@/features/transactions/use-transaction-rows';
import { groupTransactionsByDay, type DayGroup } from '@/features/transactions/group-by-day';
import { useTheme } from '@/hooks/use-theme';

/**
 * Search across every transaction.
 *
 * A search field the user types into, rather than the native navigation search
 * bar: this is a pushed screen with its own cancel affordance, and a plain field
 * keeps focus, clearing and the empty states under one roof instead of split
 * between a native control and this component.
 *
 * Results are day-grouped with the year shown, since they span every year on
 * record — the one place in the app where a date without a year is ambiguous.
 */
export function SearchView() {
  const router = useRouter();
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const { results, searchedQuery, isLoading, isError, error, refresh } = useTransactionSearch(query);

  const sections = useMemo(
    () => groupTransactionsByDay(results).map((day) => ({ ...day, data: day.transactions })),
    [results],
  );

  const { renderItem } = useTransactionRowNavigation();

  const renderSectionHeader = useCallback(
    ({ section }: { section: DayGroup }) => <DayHeader day={section} showYear />,
    [],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const isBlank = query.trim().length === 0;

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
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search transactions"
          />
        </View>

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
          results.length > 0 ? <SearchSummary transactions={results} /> : null
        }
        ListEmptyComponent={
          <SearchPlaceholder
            isBlank={isBlank}
            isLoading={isLoading}
            isError={isError}
            error={error}
            searchedQuery={searchedQuery}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <AddTransactionButton onPress={() => router.push('/transaction/new')} />
    </Screen>
  );
}

/**
 * What the list shows when it has no rows.
 *
 * The four states are mutually exclusive and each says something different about
 * why the screen is empty, so they are resolved in one place rather than as four
 * competing `ListEmptyComponent` expressions.
 */
function SearchPlaceholder({
  isBlank,
  isLoading,
  isError,
  error,
  searchedQuery,
}: {
  isBlank: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  searchedQuery: string;
}) {
  if (isError) {
    return (
      <EmptyState
        title="Couldn’t search"
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

  if (isBlank) {
    return <EmptyState title="Search transactions" detail="Type to search titles and categories." />;
  }

  return <EmptyState title="No transactions found" detail={`Nothing matches “${searchedQuery}”.`} />;
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
});
