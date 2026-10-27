import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { Transaction } from '@/domain/types';
import {
  TransactionRow,
  TransactionRowCard,
} from '@/features/transactions/components/transaction-row';
import { isOptimisticId } from '@/features/transactions/mutations';

/**
 * The three things a transaction row can navigate to.
 *
 * A row has three tap targets — itself, its category icon, and its
 * subcategory label — and every screen that lists transactions wires all
 * three. That was six copies of the same two callbacks across four screens,
 * which is how one of them quietly lost the guard below.
 *
 * **Every function here is memoised, and must stay that way.** Passing fresh
 * closures to a list makes it treat every row as changed and re-render the whole
 * period, which on a long month is visible as a stall.
 *
 * @returns `renderItem`, ready to hand to a `SectionList` or `FlatList`.
 */
export function useTransactionRowNavigation() {
  const router = useRouter();

  const openTransaction = useCallback(
    (transaction: Transaction) => {
      // A row that is still saving carries only a placeholder id, so there is
      // no record to open yet. Brief in practice — it is replaced by the real
      // row as soon as the insert returns.
      if (isOptimisticId(transaction.id)) return;
      router.push(`/transaction/${transaction.id}`);
    },
    [router],
  );

  const openCategory = useCallback(
    (category: string) => {
      router.push(`/transactions/category/${encodeURIComponent(category)}`);
    },
    [router],
  );

  const openSubCategory = useCallback(
    (category: string, subCategory: string) => {
      router.push(
        `/transactions/category/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`,
      );
    },
    [router],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: Transaction;
      index: number;
      section: { data: readonly Transaction[] };
    }) => (
      <TransactionRowCard
        first={index === 0}
        last={index === section.data.length - 1}>
        <TransactionRow
          transaction={item}
          onPress={openTransaction}
          onCategoryPress={openCategory}
          onSubCategoryPress={openSubCategory}
        />
      </TransactionRowCard>
    ),
    [openTransaction, openCategory, openSubCategory],
  );

  return { renderItem, openTransaction, openCategory, openSubCategory };
}
