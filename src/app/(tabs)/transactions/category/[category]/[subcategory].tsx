import { Stack, useLocalSearchParams } from 'expo-router';

import { CategoryView } from '@/features/category/category-view';

/**
 * One subcategory.
 *
 * A separate route rather than a query parameter, so the back gesture returns to
 * the parent category — the drill-down is a place, not a filter state.
 */
export default function SubcategoryScreen() {
  const { category, subcategory } = useLocalSearchParams<{
    category: string;
    subcategory: string;
  }>();

  const parent = decodeURIComponent(category ?? '');
  const name = decodeURIComponent(subcategory ?? '');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: name }} />
      <CategoryView category={parent} subCategory={name} />
    </>
  );
}
