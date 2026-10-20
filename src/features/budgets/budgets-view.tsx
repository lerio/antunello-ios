import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import { useBudgets, type BudgetWithProgress } from '@/features/budgets/use-budgets';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { symbolForCategory } from '@/lib/sf-symbols';
import { useTheme } from '@/hooks/use-theme';

/**
 * This month's budgets and how much of each is gone.
 *
 * A flat list of cards rather than a grouped or sorted one: the web app shows
 * them in category order, and reordering by how close each is to its limit would
 * be a judgement the user did not ask for.
 */
export function BudgetsView() {
  const router = useRouter();
  const theme = useTheme();
  const { items, isLoading, isError, error, refresh } = useBudgets();

  const handleAdd = useCallback(() => router.push('/budget/new'), [router]);
  const handleEdit = useCallback(
    (budget: BudgetWithProgress) => router.push(`/budget/${budget.budget.id}`),
    [router],
  );

  return (
    <Screen>
      <ScreenHeader title="Budgets" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {isLoading && items.length === 0 ? (
          <ActivityIndicator style={styles.loading} />
        ) : isError ? (
          <EmptyState
            style={styles.empty}
            title="Couldn’t load budgets"
            detail={error instanceof Error ? error.message : 'Unknown error'}
          />
        ) : items.length === 0 ? (
          <EmptyState
            style={styles.empty}
            title="No budgets yet"
            detail="Set a monthly limit for a category to track it here."
          />
        ) : (
          items.map((item) => (
            <BudgetCard key={item.budget.id} item={item} onPress={handleEdit} />
          ))
        )}

        {items.length > 0 ? (
          <Pressable
            onPress={handleAdd}
            accessibilityRole="button"
            accessibilityLabel="Add a budget"
            style={({ pressed }) => [
              styles.addButton,
              { borderColor: theme.separator, opacity: pressed ? 0.6 : 1 },
            ]}>
            <SymbolView name="plus" size={15} tintColor={theme.tint} />
            <ThemedText themeColor="tint" style={styles.addLabel}>
              Add budget
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * One budget.
 *
 * The whole card opens the edit sheet, rather than a pencil in the corner as on
 * the web: a 20-point icon is not a comfortable target, and a card has nothing
 * else to be tapped for.
 */
function BudgetCard({
  item,
  onPress,
}: {
  item: BudgetWithProgress;
  onPress: (item: BudgetWithProgress) => void;
}) {
  const theme = useTheme();
  const { budget, spent, progress } = item;

  const levelColor =
    progress.level === 'over'
      ? theme.expense
      : progress.level === 'warning'
        ? theme.warning
        : theme.tint;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Edit the ${budget.category} budget`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={styles.cardHead}>
        <SymbolView
          name={symbolForCategory(budget.category)}
          size={17}
          tintColor={theme.textSecondary}
        />
        <ThemedText style={styles.category} numberOfLines={1}>
          {budget.category}
        </ThemedText>
        <ThemedText style={[styles.percentage, { color: levelColor }]}>
          {progress.percentage}%
        </ThemedText>
      </View>

      <PrivacyValue style={styles.limit} numberOfLines={1}>
        {formatCurrency(budget.amount, 'EUR')}
      </PrivacyValue>

      <ProgressBar width={progress.barWidth} color={levelColor} track={theme.backgroundElement} />

      <View style={styles.figures}>
        <PrivacyValue themeColor="textSecondary" style={styles.figure} numberOfLines={1}>
          {`Spent ${formatCurrency(Math.abs(spent), 'EUR')}`}
        </PrivacyValue>
        <PrivacyValue
          style={[styles.figure, progress.isOverBudget && { color: theme.expense, fontWeight: '700' }]}
          numberOfLines={1}>
          {`${progress.isOverBudget ? 'Over' : 'Remaining'} ${formatCurrency(Math.abs(progress.remaining), 'EUR')}`}
        </PrivacyValue>
      </View>
    </Pressable>
  );
}

/** A rounded track with a filled fraction. */
function ProgressBar({
  width,
  color,
  track,
}: {
  width: number;
  color: string;
  track: string;
}) {
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={[styles.fill, { width: `${width}%`, backgroundColor: color }]} />
    </View>
  );
}


const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five + BottomTabInset,
    gap: Spacing.two,
  },
  loading: {
    marginTop: Spacing.five,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  category: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  limit: {
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  figure: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
});
