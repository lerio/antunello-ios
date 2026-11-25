import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, CardIconButton } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Layout, Spacing } from '@/constants/theme';
import type { FundCategory } from '@/domain/types';
import { useAllFunds } from '@/features/settings/use-fund-categories';
import { useTheme } from '@/hooks/use-theme';

/**
 * Settings → Funds: one card per fund, with a pencil that opens its edit sheet.
 *
 * Adding is the floating + on the Settings screen; deleting is the "Delete Fund"
 * link inside the edit sheet. Same as the web manager.
 */
export function FundsManager() {
  const router = useRouter();
  const { data: funds, isLoading } = useAllFunds();
  const fundList = funds ?? [];

  if (isLoading) {
    return [0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={Layout.cardRadius} />);
  }

  if (fundList.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          No fund categories configured yet.
        </ThemedText>
      </Card>
    );
  }

  return fundList.map((fund) => (
    <FundCard key={fund.id} fund={fund} onEdit={() => router.push(`/fund/${fund.id}`)} />
  ));
}

function FundCard({ fund, onEdit }: { fund: FundCategory; onEdit: () => void }) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.title}>
          <ThemedText style={styles.name}>{fund.name}</ThemedText>
          {!fund.is_active ? <Pill label="Inactive" /> : null}
        </View>
        <CardIconButton symbol="pencil" label={`Edit ${fund.name}`} onPress={onEdit} />
      </View>

      {fund.description ? (
        <ThemedText themeColor="textSecondary" style={styles.detail}>
          {fund.description}
        </ThemedText>
      ) : null}

      <View style={styles.meta}>
        <ThemedText style={[styles.detail, { color: theme.text }]}>
          Initial amount: {fund.amount.toFixed(2)} {fund.currency}
        </ThemedText>
        {fund.top_level_category ? <Pill label={fund.top_level_category} /> : null}
      </View>
    </Card>
  );
}

function Pill({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText themeColor="textSecondary" style={styles.pillLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.iconButton,
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: 999,
  },
  pillLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
});
