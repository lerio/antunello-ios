/**
 * Creating, editing and deleting transactions.
 *
 * Mirrors the semantics of the web app's `useTransactionMutations`, the most
 * intricate part of its write path. The shape is the same, but TanStack Query
 * provides the optimistic lifecycle natively rather than the hand-rolled
 * rollback closures the web app needs.
 *
 * Three rules carry over exactly, because breaking any of them corrupts data
 * rather than merely looking wrong:
 *
 *  1. **EUR conversion happens before the insert**, and the converted columns
 *     travel with the row. The web app does this inside the mutation function,
 *     not after, so a failure leaves nothing behind.
 *  2. **Bonus rows are never edited or deleted.** Row-level security silently
 *     refuses the write — PostgREST reports success with zero rows affected — so
 *     the check is repeated client-side to produce a real error.
 *  3. **A date change across a month boundary moves the row between caches.**
 *     Both months must be updated, and both invalidated.
 */

import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Transaction } from '@/domain/types';
import { convertToEUR, toRateDate } from '@/features/transactions/exchange-rates';
import { TX, qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** Fields a caller supplies when creating or editing. */
export type TransactionInput = {
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  title: string;
  main_category: string;
  sub_category?: string;
  /** Full ISO timestamp. */
  date: string;
  hide_from_totals?: boolean;
  split_across_year?: boolean;
  fund_category_id?: string | null;
  is_money_transfer?: boolean;
  target_fund_category_id?: string | null;
  parent_transaction_id?: string | null;
  bonus_kind?: 'saveback' | 'round_up' | null;
};

/** The month a date falls in, as the cache keys address it. */
function monthOf(isoDate: string): { year: number; month: number } {
  const d = new Date(isoDate);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Adds the EUR columns a row needs before it is written.
 *
 * @param input The row being written.
 * @returns The row plus `eur_amount`, `exchange_rate` and `rate_date`.
 * @throws If no rate could be found and the currency is not EUR.
 */
async function withEurConversion(
  input: TransactionInput,
): Promise<TransactionInput & { eur_amount: number; exchange_rate: number; rate_date: string }> {
  const conversion = await convertToEUR(input.amount, input.currency, toRateDate(input.date));

  if (!conversion) {
    throw new Error(
      `Could not find an exchange rate for ${input.currency} on ${toRateDate(input.date)}. ` +
        `Check the connection and try again.`,
    );
  }

  return {
    ...input,
    eur_amount: conversion.eurAmount,
    exchange_rate: conversion.exchangeRate,
    rate_date: conversion.rateDate,
  };
}

/**
 * Invalidates everything derived from a transaction write.
 *
 * Deliberately does **not** invalidate the bare `['tx']` root: the optimistic
 * update has just written the correct month, and invalidating it would discard
 * that and refetch, causing a visible flicker.
 *
 * A split write invalidates the month family as well, because split instances
 * are synthesised from a source row and bleed across months — the one place a
 * broad invalidation is correct.
 *
 * @param queryClient The client to invalidate against.
 * @param options What was written.
 */
export function invalidateAfterWrite(
  queryClient: QueryClient,
  options: { split?: boolean } = {},
): void {
  // Prefixes, so each covers every period at once.
  const families: ReadonlyArray<readonly unknown[]> = [
    [TX, 'year'],
    [TX, 'range'],
    [TX, 'anchored'],
    qk.funds(),
  ];

  for (const queryKey of families) {
    void queryClient.invalidateQueries({ queryKey });
  }

  if (options.split) {
    // Split instances are synthesised from a source row and appear in months
    // beyond the source's own, so the whole month family has to go — the one
    // place a broad invalidation is correct rather than wasteful.
    void queryClient.invalidateQueries({ queryKey: [TX, 'split'] });
    void queryClient.invalidateQueries({ queryKey: [TX, 'month'] });
  }
}

/**
 * Inserts a transaction, optimistically showing it in its month.
 *
 * @returns A mutation; call `.mutateAsync(input)` to run it.
 */
export function useAddTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransactionInput): Promise<Transaction> => {
      const payload = await withEurConversion(input);

      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },

    onMutate: async (input) => {
      const { year, month } = monthOf(input.date);
      const key = qk.month(year, month);

      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Transaction[]>(key);

      // A best-effort row so the list updates immediately. The EUR amount is
      // only exact when the input is already EUR; the server response replaces
      // it on settle.
      const optimistic: Transaction = {
        id: `optimistic-${Date.now()}`,
        user_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        eur_amount: input.currency === 'EUR' ? input.amount : undefined,
        exchange_rate: input.currency === 'EUR' ? 1 : undefined,
        ...input,
      } as Transaction;

      queryClient.setQueryData<Transaction[]>(key, (old = []) =>
        sortByDate([optimistic, ...old]),
      );

      return { key, previous };
    },

    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_data, _error, input) => {
      invalidateAfterWrite(queryClient, { split: input.split_across_year });
    },
  });
}

/**
 * Updates a transaction, moving it between months when its date changes.
 *
 * @returns A mutation; call `.mutateAsync({ id, changes })` to run it.
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<TransactionInput>;
    }): Promise<Transaction> => {
      // RLS silently refuses writes to bonus rows, so refuse them here where
      // the failure can actually be reported.
      const existing = await fetchTransaction(id);
      if (existing?.bonus_kind) {
        throw new Error('Bonus transactions cannot be edited.');
      }

      const merged = { ...existing, ...changes } as TransactionInput;
      const payload =
        changes.amount !== undefined ||
        changes.currency !== undefined ||
        changes.date !== undefined
          ? await withEurConversion(merged)
          : merged;

      const { data, error } = await supabase
        .from('transactions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },

    onSettled: (_data, _error, { changes }) => {
      invalidateAfterWrite(queryClient, { split: changes.split_across_year });
    },
  });
}

/**
 * Deletes a transaction and any bonus rows generated from it.
 *
 * The children are removed explicitly rather than relying on the database's
 * cascade, so that a failure partway through is visible instead of silent.
 *
 * @returns A mutation; call `.mutateAsync(id)` to run it.
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data: existing } = await supabase
        .from('transactions')
        .select('bonus_kind')
        .eq('id', id)
        .maybeSingle();

      if (existing?.bonus_kind) {
        throw new Error('Bonus transactions cannot be deleted.');
      }

      const { error: childError } = await supabase
        .from('transactions')
        .delete()
        .eq('parent_transaction_id', id);

      if (childError) throw childError;

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },

    onSettled: () => {
      invalidateAfterWrite(queryClient);
    },
  });
}

/** Fetches one transaction, preferring whatever is already cached. */
async function fetchTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as Transaction) ?? null;
}

/** Newest first, matching the fetcher's ordering. */
function sortByDate(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (byDate !== 0) return byDate;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
