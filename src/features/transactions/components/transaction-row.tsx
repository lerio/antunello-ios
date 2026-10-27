import { ArrowRightLeft, GitFork } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryGlyph } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';

type TransactionRowProps = {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
  /**
   * All three list screens pass these. They stay optional because a row can be
   * rendered without anywhere to navigate to — and when they are absent the
   * labels render as plain text rather than as dead-looking tap targets.
   */
  onCategoryPress?: (category: string) => void;
  onSubCategoryPress?: (category: string, subCategory: string) => void;
};

/**
 * One transaction.
 *
 * Reproduces the web app's row semantics, which are easy to lose in a rewrite:
 *
 *  - The icon opens the category and the subcategory label opens the
 *    subcategory, so a row has **two** navigation targets besides itself.
 *  - A split instance sits on a tinted surface with a `Split` badge that says how
 *    many slices remain.
 *  - A row hidden from totals is dimmed, so it reads as excluded while still
 *    being visible in the list.
 *  - Only income is covered by privacy mode here — expenses stay readable. See
 *    `PrivacyValue`.
 */
export const TransactionRow = memo(function TransactionRow({
  transaction,
  onPress,
  onCategoryPress,
  onSubCategoryPress,
}: TransactionRowProps) {
  const theme = useTheme();

  const eurAmount =
    getTransactionDisplayEurAmount(transaction) ?? getTransactionDisplayAmount(transaction);
  const eurAmountIsKnown = getTransactionDisplayEurAmount(transaction) !== undefined;

  const showOriginalCurrency = transaction.currency !== 'EUR';
  const originalAmount = getTransactionDisplayAmount(transaction);

  const isTransfer = transaction.is_money_transfer === true;
  const isSplitInstance = transaction.split_across_year === true;
  const isIncome = transaction.type === 'income';

  // Every expense is red; movements stay neutral because no money leaves.
  const amountColor = isTransfer
    ? theme.transfer
    : isIncome
      ? theme.income
      : theme.expense;

  // Only a row excluded from totals is dimmed. A split is marked by its badge
  // and tinted surface instead, so its text keeps full contrast.
  const baseOpacity = transaction.hide_from_totals ? 0.5 : 1;

  return (
    <Pressable
      onPress={() => onPress(transaction)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          opacity: pressed ? baseOpacity * 0.7 : baseOpacity,
          backgroundColor: isSplitInstance ? theme.backgroundElement : 'transparent',
        },
      ]}>
      {isTransfer ? (
        <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
          <ArrowRightLeft size={20} color={theme.textSecondary} strokeWidth={2} />
        </View>
      ) : (
        <CategoryIcon
          category={transaction.main_category}
          subCategory={transaction.sub_category}
          onPress={onCategoryPress}
          background={theme.backgroundElement}
          tint={theme.textSecondary}
        />
      )}

      <View style={styles.middle}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {transaction.title}
        </ThemedText>

        <View style={styles.metaRow}>
          {isTransfer ? (
            <ThemedText themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
              Movement
            </ThemedText>
          ) : (
            <CategoryLabel
              mainCategory={transaction.main_category}
              subCategory={transaction.sub_category}
              onPress={onSubCategoryPress}
            />
          )}

          {isSplitInstance || transaction.split_remaining_count ? (
            <View
              style={[styles.splitChip, { backgroundColor: theme.backgroundSelected }]}>
              <GitFork size={12} color={theme.textSecondary} strokeWidth={2} />
              <ThemedText themeColor="textSecondary" style={styles.splitChipLabel}>
                {transaction.split_remaining_count
                  ? `Split · ${transaction.split_remaining_count} left`
                  : 'Split'}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.amounts}>
        <PrivacyValue
          style={[styles.amount, { color: amountColor }]}
          numberOfLines={1}>
          {`${isIncome ? '+' : ''}${
            eurAmountIsKnown
              ? formatCurrency(Math.abs(eurAmount), 'EUR')
              : formatCurrency(Math.abs(originalAmount), transaction.currency)
          }`}
        </PrivacyValue>

        {showOriginalCurrency && eurAmountIsKnown ? (
          <PrivacyValue
            themeColor="textSecondary"
            style={styles.original}
            numberOfLines={1}>
            {formatCurrency(Math.abs(originalAmount), transaction.currency)}
          </PrivacyValue>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * The rounded card around one day's rows.
 *
 * Mirrors the web app's day card: the header sits above it, the rows share one
 * bordered surface, and the first and last rows carry the rounded corners.
 */
export function TransactionRowCard({
  first,
  last,
  children,
}: {
  first: boolean;
  last: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();

  // Static styles for the shape, so a long day does not allocate a fresh object
  // per row; only the two theme colours are built here.
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator },
        first && styles.cardFirst,
        last && styles.cardLast,
      ]}>
      {children}
    </View>
  );
}

/** The circular category icon, tappable only once category routes exist. */
function CategoryIcon({
  category,
  subCategory,
  onPress,
  background,
  tint,
}: {
  category: string;
  subCategory?: string | null;
  onPress?: (category: string) => void;
  background: string;
  tint: string;
}) {
  const icon = (
    <View style={[styles.icon, { backgroundColor: background }]}>
      <CategoryGlyph
        category={category}
        subCategory={subCategory}
        size={20}
        color={tint}
      />
    </View>
  );

  if (!onPress) return icon;

  return (
    <Pressable
      onPress={() => onPress(category)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Open ${category}`}>
      {icon}
    </Pressable>
  );
}

/**
 * The subcategory, or the main category when there is no subcategory.
 *
 * Only a *sub*category is a link — with no subcategory the label is the main
 * category shown for context, and making it tappable would suggest a navigation
 * target that the web app does not offer either.
 */
function CategoryLabel({
  mainCategory,
  subCategory,
  onPress,
}: {
  mainCategory: string;
  subCategory?: string;
  onPress?: (category: string, subCategory: string) => void;
}) {
  const label = subCategory ?? mainCategory;

  if (!onPress || !subCategory) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
        {label}
      </ThemedText>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(mainCategory, subCategory)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Open ${subCategory}`}>
      <ThemedText themeColor="textSecondary" style={styles.meta} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cardFirst: {
    marginTop: Spacing.two + Spacing.one,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
  },
  cardLast: {
    marginBottom: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: Radius.large,
    borderBottomRightRadius: Radius.large,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
  },
  splitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: Spacing.half,
    borderRadius: 99,
  },
  splitChipLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  amount: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  original: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
});
