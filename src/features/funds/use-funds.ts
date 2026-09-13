/**
 * Fund accounts.
 *
 * Only the list is fetched here — enough for the transaction form's fund picker,
 * which needs each fund's name and currency. The Home balance card needs more
 * than this: per-fund balances converted to EUR, which is `useFundBalances`.
 */

import { useQuery } from '@tanstack/react-query';

import type { FundCategory } from '@/domain/types';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/**
 * Fetches the user's active fund accounts, in display order.
 *
 * Inactive funds are excluded: the web app hides them from the picker so that
 * closing an account does not require deleting it, which would orphan the
 * transactions pointing at it.
 */
export function useFunds() {
  return useQuery({
    queryKey: qk.funds(),
    queryFn: async (): Promise<FundCategory[]> => {
      const { data, error } = await supabase
        .from('fund_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data ?? []) as FundCategory[];
    },
  });
}
