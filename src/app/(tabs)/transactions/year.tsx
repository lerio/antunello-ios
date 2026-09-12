import { useLocalSearchParams, useRouter } from 'expo-router';

import { YearView } from '@/features/year/year-view';

/**
 * The year view.
 *
 * The selected year lives in route params, the same way the month view keeps its
 * period — so back-navigation restores it, and the transactions tab can be
 * reopened on whatever the user last looked at.
 */
export default function YearScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();

  const parsed = Number(params.year);
  const year = Number.isFinite(parsed) && parsed > 0 ? parsed : new Date().getFullYear();

  return (
    <YearView
      year={year}
      onSelectYear={(next) => router.setParams({ year: String(next) })}
    />
  );
}
