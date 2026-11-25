/**
 * The user's custom categories, merged with the built-in ones.
 *
 * `useCustomCategories` is the light hook: it loads the rows and publishes them
 * to the registry while rendering, before any child reads them. Components that
 * only draw a category icon use it, so they re-render when custom icons arrive.
 * `useCategories` adds the merged lists and adding a category.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  allCategories,
  allMainCategories,
  isCategoryOfType,
  setCustomCategories,
  subCategoriesByName,
  subCategoriesFor,
  type CategoryType,
  type CustomCategory,
} from '@/features/categories/registry';
import { qk } from '@/lib/query-keys';
import { requireUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export function useCustomCategories() {
  const query = useQuery({
    queryKey: qk.customCategories(),
    queryFn: async (): Promise<CustomCategory[]> => {
      const { data, error } = await supabase.from('custom_categories').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as CustomCategory[];
    },
  });

  const rows = query.data;
  // Done while rendering so the first render after the rows arrive already sees them.
  useMemo(() => setCustomCategories(rows ?? []), [rows]);

  return query;
}

/** The values for a new category; `parentCategory` omitted means a main category. */
export type NewCategory = {
  name: string;
  /** The category's own type, or for a subcategory its parent's. */
  type: CategoryType;
  parentCategory?: string;
  icon?: string;
};

export function useCategories() {
  const query = useCustomCategories();
  const queryClient = useQueryClient();

  const addCategory = useMutation({
    mutationFn: async (values: NewCategory) => {
      const userId = await requireUserId();
      const { error } = await supabase.from('custom_categories').insert({
        user_id: userId,
        name: values.name,
        parent_category: values.parentCategory ?? null,
        type: values.type,
        icon: values.icon || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.customCategories() }),
  });

  // The registry is rebuilt when the rows change; these read it, so they are
  // memoised on the rows to stay stable between renders.
  const rows = query.data;
  return useMemo(
    () => ({
      categories: allCategories(),
      mainCategories: allMainCategories(),
      subCategoriesByName,
      subCategoriesFor,
      isCategoryOfType,
      isLoading: query.isLoading,
      addCategory,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query.isLoading, addCategory],
  );
}
