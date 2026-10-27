import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryGlyph } from '@/components/category-icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORIES_WITH_TYPES, SUB_CATEGORIES } from '@/domain/types';
import { CategoryChart } from '@/features/category/category-chart';
import { useCategoryTransactions } from '@/features/category/use-category-transactions';
import { TransactionRow } from '@/features/transactions/components/transaction-row';
import { useTransactionRowNavigation } from '@/features/transactions/use-transaction-rows';
import { useTheme } from '@/hooks/use-theme';
import type { TimeRange } from '@/lib/query-keys';

type CategoryViewProps = {
  category: string;
  /** Absent on the category screen; set on the subcategory screen. */
  subCategory?: string;
};

/**
 * One category — or one subcategory — over time.
 *
 * The chart's range is owned here rather than by the chart, because the same
 * range drives the transaction list beneath it; two independent selectors would
 * let the two disagree about what period is on screen.
 */
export function CategoryView({ category, subCategory }: CategoryViewProps) {
  const theme = useTheme();
  const router = useRouter();
  // The shared handlers, so this screen gets the optimistic-row guard the other
  // three list screens have — its own copy had lost it. Called here, above the
  // early returns below, because a hook cannot be conditional.
  const { openTransaction } = useTransactionRowNavigation();
  const [timeRange, setTimeRange] = useState<TimeRange>('1y');

  const isValid = isValidCategory(category, subCategory);

  const { transactions, stats, isLoading, isError, refresh } = useCategoryTransactions(
    isValid ? category : null,
    subCategory ?? null,
    timeRange,
  );

  if (!isValid) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ThemedText type="subtitle">Unknown category</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            “{subCategory ?? category}” is not one of the app’s categories.
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <View style={styles.heading}>
          <CategoryGlyph category={category} size={22} color={theme.textSecondary} />
          <View style={styles.headingText}>
            {subCategory ? (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel={`Back to ${category}`}>
                <ThemedText themeColor="textSecondary" style={styles.parent}>
                  {category}
                </ThemedText>
              </Pressable>
            ) : null}
            <ThemedText style={styles.title}>{subCategory ?? category}</ThemedText>
          </View>
        </View>

        <CategoryChart
          dataPoints={stats.dataPoints}
          totalAmount={stats.totalAmount}
          totalTransactions={stats.totalTransactions}
          timeRange={timeRange}
          onSelectRange={setTimeRange}
          isLoading={isLoading && transactions.length === 0}
        />

        {isError ? (
          <ThemedText themeColor="destructive" style={styles.centeredText}>
            Couldn’t load these transactions.
          </ThemedText>
        ) : isLoading && transactions.length === 0 ? (
          <ActivityIndicator style={styles.loading} />
        ) : transactions.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            Nothing in this range.
          </ThemedText>
        ) : (
          <View style={styles.list}>
            {transactions.map((transaction) => (
              <View
                key={transaction.id}
                style={[styles.listRow, { borderBottomColor: theme.separator }]}>
                <TransactionRow transaction={transaction} onPress={openTransaction} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Whether a category, and optionally a subcategory, actually exists.
 *
 * Route params are user-visible strings, so a mistyped or stale link should say
 * so rather than render an empty page that looks like a bug.
 */
function isValidCategory(category: string, subCategory?: string): boolean {
  const known = CATEGORIES_WITH_TYPES.some((entry) => entry.category === category);
  if (!known) return false;
  if (!subCategory) return true;

  return (SUB_CATEGORIES[category] ?? []).includes(subCategory);
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingText: {
    flex: 1,
    gap: 1,
  },
  parent: {
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  list: {
    gap: 0,
  },
  listRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
    fontSize: 14,
  },
  loading: {
    marginTop: Spacing.four,
  },
});
