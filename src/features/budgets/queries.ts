/**
 * Budget reads and writes.
 *
 * Much smaller than the transaction side: a budget is a category and a limit,
 * with no currency, no split, and no derived EUR column. The only cross-cutting
 * concern is that `user_id` has to be set on insert, which RLS enforces — a
 * missing one is rejected rather than silently written to nobody.
 */

import type { QueryClient } from '@tanstack/react-query';

import type { Budget } from '@/domain/types';
import { qk } from '@/lib/query-keys';
import { requireUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * Fetches every budget, ordered by category.
 *
 * @returns The budgets.
 */
export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*').order('category');

  if (error) throw error;
  return (data ?? []) as Budget[];
}


/**
 * Creates a budget.
 *
 * @param category The main category the budget covers.
 * @param amount The monthly limit, in EUR.
 * @returns The created budget.
 */
export async function createBudget(category: string, amount: number): Promise<Budget> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('budgets')
    .insert([{ category, amount, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data as Budget;
}

/**
 * Updates a budget's limit.
 *
 * The category is not updatable. The page looks spending up by category, so
 * moving a budget to a category that already has one would leave two budgets
 * competing for the same spend — and the web app disables the field for the same
 * reason.
 *
 * @param id The budget id.
 * @param amount The new monthly limit.
 * @returns The updated budget.
 */
export async function updateBudgetAmount(id: string, amount: number): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update({ amount })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Budget;
}

/**
 * Deletes a budget.
 *
 * @param id The budget id.
 */
export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);

  if (error) throw error;
}

/**
 * Refreshes the budget list after a write.
 *
 * Only the budgets: a budget is a target rather than a transaction, so writing
 * one changes no month, no balance and no total. The spending side of the card
 * is derived from the month's transactions, which a budget write does not touch.
 *
 * @param queryClient The client to invalidate against.
 */
export async function invalidateBudgets(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: qk.budgets() });
}
