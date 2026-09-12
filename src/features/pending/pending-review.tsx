import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFunds } from '@/features/funds/use-funds';
import { formStateFromPending } from '@/features/pending/from-pending';
import { useAcceptPending, useDismissPending } from '@/features/pending/use-pending-actions';
import { usePendingTransactions } from '@/features/pending/use-pending-transactions';
import {
  TransactionForm,
} from '@/features/transactions/form/transaction-form';
import type { TransactionInput } from '@/features/transactions/mutations';
import { messageOf } from '@/lib/errors';
import { hapticError, hapticSelect, hapticSuccess } from '@/lib/haptics';

/**
 * Reviewing bank imports, one at a time.
 *
 * The queue is read once and then walked through with an index, rather than
 * refetched after every accept: the list is what the user is working through,
 * and having it rearrange underneath them mid-review would be disorienting. What
 * the refetch *would* have caught — a row the sync added while they were
 * reviewing — appears next time the screen opens, which is soon enough for data
 * that arrives on a cron.
 *
 * The form is the same component the add and edit screens use, with its submit
 * redirected to the accept flow. Reviewing a bank row is not a different kind of
 * editing; it is editing with a different ending.
 */
export function PendingReview() {
  const { pending, isLoading, isError, error } = usePendingTransactions();
  const { data: funds = [] } = useFunds();

  const accept = useAcceptPending();
  const dismiss = useDismissPending();

  const [index, setIndex] = useState(0);
  // Rows the user has handled in this session, so the queue shortens as they go
  // without the list itself changing underneath the index.
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());

  const queue = useMemo(
    () => pending.filter((row) => !handled.has(row.id)),
    [pending, handled],
  );

  const current = queue[0];

  const advance = useCallback(() => {
    if (!current) return;
    setHandled((previous) => new Set(previous).add(current.id));
    setIndex((value) => value + 1);
  }, [current]);

  const handleSkip = useCallback(() => {
    if (!current) return;

    dismiss.mutate(current.id, {
      onSuccess: () => {
        hapticSelect();
        advance();
      },
      onError: (skipError) => {
        hapticError();
        Alert.alert('Could not skip', messageOf(skipError));
      },
    });
  }, [advance, current, dismiss]);

  const handleAccept = useCallback(
    async (input: TransactionInput) => {
      if (!current) return;

      const { warnings } = await accept.mutateAsync({ pending: current, input, funds });
      hapticSuccess();

      // A skipped bonus is not a failure — the transaction was saved — so it is
      // reported rather than thrown, and the review carries on.
      for (const warning of warnings) {
        Alert.alert('Bonus not created', warning);
      }

      advance();
    },
    [accept, advance, current, funds],
  );

  if (isLoading) {
    return (
      <Screen insetTop={false}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen insetTop={false}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.centered}>
          <ThemedText type="subtitle">Couldn’t load the queue</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.detail}>
            {messageOf(error)}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen insetTop={false}>
        <Stack.Screen options={{ title: 'Review' }} />
        <View style={styles.centered}>
          <ThemedText type="subtitle">All caught up</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.detail}>
            {index > 0
              ? `${index} bank ${index === 1 ? 'transaction' : 'transactions'} reviewed.`
              : 'No bank transactions are waiting.'}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: queue.length > 1 ? `${queue.length} to review` : 'Review',
        }}
      />

      <TransactionForm
        // Remounts per row, so the fields, the dirty check and the title
        // suggestion list all start fresh rather than carrying the last one over.
        key={current.id}
        state={formStateFromPending(current, funds)}
        onSubmit={handleAccept}
        onSkip={handleSkip}
        onDone={() => undefined}
        submitLabel="Accept"
        skipLabel="Skip"
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  detail: {
    textAlign: 'center',
  },
});
