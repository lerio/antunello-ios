/**
 * Budgets with their current month's progress.
 *
 * Progress comes from the *current* month, not a selected one — matching the web
 * app, where the budgets page is always about now. The month query is the same
 * one the month view uses, so the two cannot disagree about what was spent, and
 * a figure the user just checked in the transaction list is the figure the
 * budget card shows.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Budget } from '@/domain/types';
import {
  budgetProgress,
  computeSpendingByCategory,
  type BudgetProgress,
} from '@/features/budgets/budget-progress';
import {
  createBudget,
  deleteBudget,
  fetchBudgets,
  invalidateBudgets,
  updateBudgetAmount,
} from '@/features/budgets/queries';
import { useMonthTransactions } from '@/features/transactions/use-month-transactions';
import { qk } from '@/lib/query-keys';

export type BudgetWithProgress = {
  budget: Budget;
  spent: number;
  progress: BudgetProgress;
};

type Budgets = {
  items: BudgetWithProgress[];
  /** Every category that already has a budget, for the form's picker. */
  takenCategories: string[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refresh: () => Promise<void>;
};

/**
 * Loads budgets and measures each against this month's spending.
 *
 * @param now Reference date, so the month under test is injectable.
 * @returns The budgets with their progress.
 */
export function useBudgets(now: Date = new Date()): Budgets {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const budgetsQuery = useQuery({ queryKey: qk.budgets(), queryFn: fetchBudgets });
  // The same query the month view runs, so this is a cache hit whenever the user
  // has looked at the current month — and shares its invalidation after a write.
  const { transactions, isLoading: isTransactionsLoading } = useMonthTransactions(year, month);

  const spendingByCategory = useMemo(
    () => computeSpendingByCategory(transactions),
    [transactions],
  );

  const items = useMemo(() => {
    const budgets = budgetsQuery.data ?? [];

    return budgets.map((budget) => {
      const spent = spendingByCategory[budget.category] ?? 0;
      return { budget, spent, progress: budgetProgress(budget, spent) };
    });
  }, [budgetsQuery.data, spendingByCategory]);

  return {
    items,
    takenCategories: (budgetsQuery.data ?? []).map((budget) => budget.category),
    isLoading: budgetsQuery.isLoading || isTransactionsLoading,
    isError: budgetsQuery.isError,
    error: budgetsQuery.error,
    refresh: async () => {
      await budgetsQuery.refetch();
    },
  };
}

/**
 * The budget write operations.
 *
 * No optimistic updates here, unlike transactions. A budget write changes one
 * row on a screen that shows every row, so an optimistic patch would be a
 * one-row change the user cannot see happen — the round trip is quicker than the
 * animation, and getting the rollback right would cost more than it saves.
 *
 * @returns The three mutations.
 */
export function useBudgetMutations() {
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: ({ category, amount }: { category: string; amount: number }) =>
      createBudget(category, amount),
    onSuccess: () => invalidateBudgets(queryClient),
  });

  const update = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      updateBudgetAmount(id, amount),
    onSuccess: () => invalidateBudgets(queryClient),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => invalidateBudgets(queryClient),
  });

  return { addBudget: add, updateBudget: update, deleteBudget: remove };
}
