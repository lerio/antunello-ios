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
 *     the check is repeated client-side to produce a real error. Deleting a
 *     parent is nevertheless safe: a composite foreign key with `on delete
 *     cascade` removes its children atomically, and referential-integrity
 *     triggers bypass RLS.
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

/**
 * Prefix identifying a row that exists only in the local cache.
 *
 * An optimistic insert appears in the list before the database has assigned it
 * an id, so it is given a placeholder. That placeholder must never reach the
 * database: `id` is a `uuid` column, and `22P02 invalid input syntax for type
 * uuid` is what comes back if it does — an error that says nothing about the
 * actual cause.
 */
export const OPTIMISTIC_ID_PREFIX = 'optimistic-';

/**
 * Whether a row is a local placeholder rather than a persisted record.
 *
 * @param id The id to test.
 */
export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

/**
 * The signed-in user's id.
 *
 * Required on insert: the row-level security policy for `transactions` is
 * `auth.uid() = user_id`, and `user_id` has no database default — so a row
 * inserted without it fails with `42501 new row violates row-level security
 * policy` rather than a helpful "column is required".
 *
 * Read from the local session rather than `auth.getUser()`. The id is already
 * the one inside the access token, which is what the policy compares against, so
 * a server round-trip would confirm nothing extra.
 *
 * @throws If there is no session.
 */
async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user.id) {
    throw new Error('You are not signed in.');
  }

  return session.user.id;
}

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
 * Invalidates everything affected by a transaction write.
 *
 * **The month is included, and must be.** An earlier version excluded it on the
 * reasoning that an optimistic update had already written the correct state. It
 * had not: a delete made no optimistic change at all, and an insert left its
 * placeholder row in place rather than replacing it with the saved one — so the
 * list kept showing a deleted transaction and a created one stayed unopenable,
 * since it still carried the placeholder id.
 *
 * Refetching is cheap enough here and does not flash: a query keeps its current
 * data while a refetch is in flight, so the list shows the old state for a
 * moment rather than emptying. Optimistic updates still apply, so the common
 * case is correct immediately and the refetch only confirms it.
 *
 * @param queryClient The client to invalidate against.
 */
export function invalidateAfterWrite(queryClient: QueryClient): void {
  // Prefixes, so each covers every period at once.
  const families: readonly (readonly unknown[])[] = [
    [TX, 'month'],
    [TX, 'year'],
    [TX, 'range'],
    [TX, 'anchored'],
    // The single-row cache the edit screen reads. It covers every id at once.
    [TX, 'one'],
    // `staleTime: Infinity` and persisted, so only an invalidation can ever
    // refresh it — and the month selector is built from it, which makes a
    // newly-entered earlier date unreachable without this.
    qk.firstTransactionDate(),
    // Balances, not the fund list: a transaction moves money within a fund
    // rather than changing which funds exist, so refetching the cheap list
    // would be pointless while missing the thing that actually changed.
    qk.fundBalances(),
  ];

  for (const queryKey of families) {
    void queryClient.invalidateQueries({ queryKey });
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
      const [payload, userId] = await Promise.all([withEurConversion(input), requireUserId()]);

      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...payload, user_id: userId }])
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

      return { key, previous, optimisticId: optimistic.id };
    },

    onSuccess: (created, _input, context) => {
      // Swap the placeholder for the saved row as soon as the id exists. Until
      // this happens the row carries a placeholder id, which cannot be opened —
      // so tapping a freshly added transaction would do nothing.
      if (!context) return;
      queryClient.setQueryData<Transaction[]>(context.key, (old = []) =>
        sortByDate(old.map((row) => (row.id === context.optimisticId ? created : row))),
      );
    },

    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_data, _error, input) => {
      invalidateAfterWrite(queryClient);
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
      if (isOptimisticId(id)) {
        throw new Error('This transaction is still being saved. Try again in a moment.');
      }

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

    onSuccess: (updated) => {
      // Written, not merely invalidated. The edit screen seeds its form from
      // this key and `useReducer` reads its initial state once, so a stale row
      // left in the cache would be handed to the form and the user's next save
      // would put the old values back. Marking it stale refetches *after* that
      // has already happened.
      queryClient.setQueryData(qk.one(updated.id), updated);
    },

    onSettled: () => {
      invalidateAfterWrite(queryClient);
    },
  });
}

/**
 * Deletes a transaction, and with it any bonus rows generated from it.
 *
 * The children go with the parent through the database, not through a second
 * statement here. That is not a shortcut — the delete policy is
 * `auth.uid() = user_id and bonus_kind is null`, so a `.delete()` aimed at the
 * child rows matches nothing and reports success while deleting nothing, and a
 * composite foreign key with `on delete cascade` removes them atomically
 * (referential-integrity triggers bypass row-level security). The web app does
 * the same. An earlier version of this function issued that child delete
 * explicitly, with a comment claiming it made a partial failure visible; it
 * could not delete anything, and the comment described a property the code did
 * not have.
 *
 * @returns A mutation; call `.mutateAsync(id)` to run it.
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (isOptimisticId(id)) {
        throw new Error('This transaction is still being saved. Try again in a moment.');
      }

      const { data: existing } = await supabase
        .from('transactions')
        .select('bonus_kind')
        .eq('id', id)
        .maybeSingle();

      if (existing?.bonus_kind) {
        throw new Error('Bonus transactions cannot be deleted.');
      }

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },

    onMutate: async (id: string) => {
      // Remove it from whichever month is showing it, rather than waiting for a
      // refetch — a deleted row lingering on screen reads as the delete having
      // failed.
      const snapshots = new Map<readonly unknown[], Transaction[] | undefined>();

      for (const [key, rows] of queryClient.getQueriesData<Transaction[]>({
        queryKey: [TX, 'month'],
      })) {
        if (!rows) continue;

        const next = rows.filter(
          (row) => row.id !== id && row.parent_transaction_id !== id,
        );
        if (next.length === rows.length) continue;

        snapshots.set(key, rows);
        queryClient.setQueryData(key, next);
      }

      return { snapshots };
    },

    onError: (_error, _id, context) => {
      if (!context) return;
      for (const [key, rows] of context.snapshots) {
        queryClient.setQueryData(key, rows);
      }
    },

    onSettled: () => {
      invalidateAfterWrite(queryClient);
    },
  });
}

/**
 * Inserts several transactions at once.
 *
 * Only the Trade Republic bonuses use this, and only ever two rows at a time,
 * but they must go in together: a saveback without its round-up is a half-made
 * payment, and inserting them one at a time would leave that state visible if
 * the second failed.
 *
 * No optimistic update. These rows are children of a card transaction that was
 * written moments earlier and is already on screen; showing two synthetic rows
 * before the database has accepted them would add a flicker to a flow that
 * completes in a fraction of a second.
 *
 * @returns A mutation; call `.mutateAsync(rows)` to run it.
 */
export function useAddBonusTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: TransactionInput[]): Promise<Transaction[]> => {
      if (rows.length === 0) return [];

      const [payloads, userId] = await Promise.all([
        Promise.all(rows.map((row) => withEurConversion(row))),
        requireUserId(),
      ]);

      const { data, error } = await supabase
        .from('transactions')
        .insert(payloads.map((payload) => ({ ...payload, user_id: userId })))
        .select();

      if (error) throw error;
      return (data ?? []) as Transaction[];
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
