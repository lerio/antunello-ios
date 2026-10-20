import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AtAGlanceCard } from '@/features/home/at-a-glance-card';
import { NetWorthCard } from '@/features/home/net-worth-card';
import { TX, qk } from '@/lib/query-keys';

/**
 * Home.
 *
 * Two questions and nothing else: is this month on track, and what is
 * everything worth. The figures come from the same RPCs as the web app, so the
 * two clients cannot disagree about them.
 */
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        [
          qk.fundBalances(),
          qk.monthPace(),
          qk.monthMovers(),
          // Every chart range at once, rather than the one on screen.
          [TX, 'anchored'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <Screen>
      <ScreenHeader title="Home" subtitle={todayLabel()} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.three },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <NetWorthCard />
        <AtAGlanceCard />
      </ScrollView>
    </Screen>
  );
}

/** `Tuesday, 20 October` — context for the two cards below. */
function todayLabel(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayMonth = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
  return `${weekday}, ${dayMonth}`;
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
