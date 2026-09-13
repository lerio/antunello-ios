import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/domain/currency';
import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from '@/domain/split-transactions';
import { isReadOnlyTransaction } from '@/domain/transaction-utils';
import type { Transaction } from '@/domain/types';
import { PrivacyValue } from '@/features/privacy/privacy-value';
import { useTheme } from '@/hooks/use-theme';
import { symbolForCategory } from '@/lib/sf-symbols';

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
 *  - A split instance is dimmed and desaturated, and shows how many slices
 *    remain.
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
  const isReadOnly = isReadOnlyTransaction(transaction);
  const isSplitInstance = transaction.split_across_year === true;

  const amountColor = isTransfer
    ? theme.transfer
    : transaction.type === 'expense'
      ? theme.expense
      : theme.income;

  return (
    <Pressable
      onPress={() => onPress(transaction)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.6 : transaction.hide_from_totals ? 0.5 : 1 },
        isReadOnly && styles.readOnly,
      ]}>
      <CategoryIcon
        category={transaction.main_category}
        onPress={onCategoryPress}
        background={theme.backgroundElement}
        tint={theme.textSecondary}
      />

      <View style={styles.middle}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {transaction.title}
        </ThemedText>

        <View style={styles.metaRow}>
          <CategoryLabel
            mainCategory={transaction.main_category}
            subCategory={transaction.sub_category}
            onPress={onSubCategoryPress}
          />

          {isSplitInstance ? (
            <SymbolView name="arrow.triangle.branch" size={12} tintColor={theme.textSecondary} />
          ) : null}

          {transaction.split_remaining_count !== undefined ? (
            <ThemedText themeColor="textSecondary" style={styles.pill}>
              {transaction.split_remaining_count} left
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.amounts}>
        <PrivacyValue
          hidden={transaction.type === 'income'}
          style={[styles.amount, { color: amountColor }]}
          numberOfLines={1}>
          {eurAmountIsKnown
            ? formatCurrency(Math.abs(eurAmount), 'EUR')
            : formatCurrency(Math.abs(originalAmount), transaction.currency)}
        </PrivacyValue>

        {showOriginalCurrency && eurAmountIsKnown ? (
          <PrivacyValue
            hidden={transaction.type === 'income'}
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

/** The circular category icon, tappable only once category routes exist. */
function CategoryIcon({
  category,
  onPress,
  background,
  tint,
}: {
  category: string;
  onPress?: (category: string) => void;
  background: string;
  tint: string;
}) {
  const icon = (
    <View style={[styles.icon, { backgroundColor: background }]}>
      <SymbolView name={symbolForCategory(category)} size={19} tintColor={tint} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  readOnly: {
    opacity: 0.6,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meta: {
    fontSize: 12,
  },
  pill: {
    fontSize: 11,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Radius.small / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 1,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  original: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
