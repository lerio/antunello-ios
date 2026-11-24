/**
 * Fund accounts for Settings → Funds: every fund, and add / update / delete.
 *
 * Written directly — `fund_categories` is an ordinary RLS-scoped table, and the
 * web app's manager also writes it straight from the browser. `useFunds` (the
 * pickers' list) hides inactive funds; this screen has to show them, or a fund
 * could never be reactivated.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FundCategory } from '@/domain/types';
import { qk } from '@/lib/query-keys';
import { requireUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** The fields the manager edits. */
export type FundDraft = {
  name: string;
  description: string;
  currency: string;
  amount: number;
  is_active: boolean;
  top_level_category: string;
};

export function useAllFunds() {
  return useQuery({
    queryKey: qk.allFunds(),
    queryFn: async (): Promise<FundCategory[]> => {
      const { data, error } = await supabase
        .from('fund_categories')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as FundCategory[];
    },
  });
}

export function useFundCategoryMutations() {
  const queryClient = useQueryClient();

  // `['funds']` covers both the pickers' list and this screen's; balances are
  // derived from the funds, so they refresh too.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['funds'] }),
      queryClient.invalidateQueries({ queryKey: qk.fundBalances() }),
    ]);

  const add = useMutation({
    mutationFn: async ({ draft, orderIndex }: { draft: FundDraft; orderIndex: number }) => {
      const userId = await requireUserId();
      const { error } = await supabase.from('fund_categories').insert({
        user_id: userId,
        name: draft.name,
        description: draft.description || null,
        currency: draft.currency || 'EUR',
        amount: draft.amount || 0,
        is_active: draft.is_active,
        order_index: orderIndex,
        top_level_category: draft.top_level_category || null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: FundDraft }) => {
      const { error } = await supabase
        .from('fund_categories')
        .update({
          name: draft.name,
          description: draft.description || null,
          currency: draft.currency,
          amount: draft.amount,
          is_active: draft.is_active,
          top_level_category: draft.top_level_category || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fund_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { addFund: add, updateFund: update, deleteFund: remove };
}
