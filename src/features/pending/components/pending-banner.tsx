import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { usePendingTransactions } from '@/features/pending/use-pending-transactions';
import { useTheme } from '@/hooks/use-theme';

/**
 * A prompt to review what the bank imported.
 *
 * The badge on the tab says how many are waiting; this says what to do about
 * them, and is the thing that actually opens the review. It renders nothing when
 * the queue is empty, so its absence is the signal that there is nothing to do.
 */
export function PendingBanner() {
  const theme = useTheme();
  const router = useRouter();
  const { pending } = usePendingTransactions();

  const count = pending.length;
  if (count === 0) return null;

  return (
    <Pressable
      onPress={() => router.push('/pending')}
      accessibilityRole="button"
      accessibilityLabel={`Review ${count} bank ${count === 1 ? 'transaction' : 'transactions'}`}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name="building.columns" size={16} tintColor={theme.tint} />

      <View style={styles.text}>
        <ThemedText style={styles.title}>
          {count} {count === 1 ? 'transaction' : 'transactions'} from your bank
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Tap to review
        </ThemedText>
      </View>

      <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
  },
});
