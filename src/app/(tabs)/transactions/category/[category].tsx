import { Stack, useLocalSearchParams } from 'expo-router';

import { CategoryView } from '@/features/category/category-view';

/**
 * One category's spending over time.
 *
 * The category name is a route param, so a link to it works from anywhere —
 * a transaction row's icon, or a search result.
 */
export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const name = decodeURIComponent(category ?? '');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: name }} />
      <CategoryView category={name} />
    </>
  );
}
