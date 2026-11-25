/**
 * How many transactions each category and subcategory has.
 *
 * Loads the two category columns of every transaction, in pages, and counts them
 * on the device — the same approach as the web app. Only runs when the
 * Categories tab opens.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchAllBatches } from '@/domain/fetch-all';
import { countCategories, type CategoryCounts } from '@/features/settings/category-sections';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

export function useCategoryCounts() {
  return useQuery({
    queryKey: qk.categoryCounts(),
    queryFn: async (): Promise<CategoryCounts> => {
      const rows = await fetchAllBatches<{ main_category: string; sub_category: string | null; type: string }>(
        (from, to) =>
          supabase
            .from('transactions')
            .select('main_category, sub_category, type')
            .order('id')
            .range(from, to),
      );
      return countCategories(rows);
    },
  });
}
