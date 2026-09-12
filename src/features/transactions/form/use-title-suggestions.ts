/**
 * Title autocomplete, backed by the `transaction_title_patterns` table.
 *
 * That table is maintained by a database trigger on every transaction insert, so
 * the suggestions reflect what the user actually types over time. Picking one
 * fills in the type and category too — the pattern records what those were the
 * last time the title was used.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TitleSuggestion } from '@/domain/types';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** Query length below which searching would match almost everything. */
const MIN_QUERY_LENGTH = 2;

const MAX_SUGGESTIONS = 10;

/** How long typing must pause before a query goes out. */
const DEBOUNCE_MS = 300;

type TitleSuggestions = {
  suggestions: TitleSuggestion[];
  /** True once the query is long enough to be worth searching for. */
  shouldShow: boolean;
};

/**
 * Suggestions matching the beginning of what has been typed.
 *
 * @param query The current title text.
 * @returns Suggestions, in last-used-then-frequency order.
 */
export function useTitleSuggestions(query: string): TitleSuggestions {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = debounced.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  const { data } = useQuery({
    queryKey: qk.titleSuggestions(trimmed),
    enabled,
    // Patterns change slowly — only a new transaction creates one — so a minute
    // of staleness is not worth a refetch per keystroke burst.
    staleTime: 60_000,
    queryFn: async (): Promise<TitleSuggestion[]> => {
      const { data: rows, error } = await supabase
        .from('transaction_title_patterns')
        .select('*')
        .ilike('title', `%${trimmed}%`)
        .order('last_used_at', { ascending: false })
        .order('frequency', { ascending: false })
        .limit(MAX_SUGGESTIONS);

      if (error) throw error;
      return (rows ?? []) as TitleSuggestion[];
    },
  });

  return { suggestions: enabled ? (data ?? []) : [], shouldShow: enabled };
}
