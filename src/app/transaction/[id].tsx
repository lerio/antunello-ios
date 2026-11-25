import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { expandSplitTransactionsForMonth } from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';
import { useFunds } from '@/features/funds/use-funds';
import { formStateFromTransaction } from '@/features/transactions/form/from-transaction';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';
import { TransactionForm } from '@/features/transactions/form/transaction-form';
import { isOptimisticId } from '@/features/transactions/mutations';
import { fetchTransaction } from '@/features/transactions/queries';
import { messageOf } from '@/lib/errors';
import { TX, qk } from '@/lib/query-keys';

/** Marker in a synthesised split-instance id; see split-transactions.ts. */
const SPLIT_MARKER = '::split::';

/**
 * Finds a transaction in whichever month is already cached.
 *
 * Editing always starts from a row the user just tapped in the month list, so
 * the row is already in memory. Seeding the query with it means the form opens
 * immediately instead of showing a spinner while a round-trip completes — the
 * difference between this feeling instant and feeling slow.
 *
 * @param queryClient The client holding the caches.
 * @param id The transaction id to find.
 * @returns The cached row, or undefined if no cached month contains it.
 */
function findCachedTransaction(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): Transaction | undefined {
  for (const [, rows] of queryClient.getQueriesData<Transaction[]>({ queryKey: [TX, 'month'] })) {
    const match = rows?.find((row) => row.id === id);
    if (match) return match;
  }
  return undefined;
}

/**
 * The read-only instance of a split transaction for the month in a synthesised
 * id (`<source>::split::YYYY-MM`), rebuilt from its source.
 */
function splitInstanceOf(source: Transaction, id: string): Transaction | undefined {
  const [, period] = id.split(SPLIT_MARKER);
  const [year, month] = (period ?? '').split('-').map(Number);
  if (!year || !month) return undefined;

  return expandSplitTransactionsForMonth([], [source], year, month).find(
    (row) => row.id === id,
  );
}

/**
 * Edit a transaction.
 *
 * Presented as a full-screen modal, like the add screen, so it covers the tab
 * bar and supplies its own navigation.
 */
export default function EditTransactionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isSplitInstance = Boolean(id?.includes(SPLIT_MARKER));

  // A split instance is not a database row — its id is synthesised on the
  // client as "<source>::split::YYYY-MM". Editing one has to act on the source,
  // or the lookup would find nothing.
  const sourceId = useMemo(
    () => (id?.includes(SPLIT_MARKER) ? id.split(SPLIT_MARKER)[0] : id),
    [id],
  );

  const { data: funds = [] } = useFunds();

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: qk.one(sourceId ?? ''),
    // An optimistic row has no database id, so there is nothing to fetch.
    enabled: Boolean(sourceId) && !isOptimisticId(sourceId ?? ''),
    // Seeded from the month list, so opening is instant. It is recorded as
    // having just been fetched, so no immediate refetch replaces the form's
    // contents mid-edit.
    initialData: () => (sourceId ? findCachedTransaction(queryClient, sourceId) : undefined),
    queryFn: () => fetchTransaction(sourceId!),
    // The row is normally served from cache, so a fetch here is the unusual
    // path — and when it fails it is worth saying so at once rather than after
    // the default 1s + 2s backoff.
    retry: false,
  });

  let body: ReactElement | ((dismiss: () => void) => ReactElement);

  if (error) {
    body = (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Couldn’t load this transaction</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.detail}>
          {messageOf(error)}
        </ThemedText>
      </ThemedView>
    );
  } else if (sourceId && isOptimisticId(sourceId)) {
    // A row that is still saving has only a placeholder id. Its real one arrives
    // with the server response, so there is nothing to edit yet.
    body = (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText themeColor="textSecondary" style={styles.detail}>
          This transaction is still being saved.
        </ThemedText>
      </ThemedView>
    );
  } else if (isLoading) {
    body = (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  } else if (!transaction) {
    body = (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Not found</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.detail}>
          This transaction no longer exists, or is not yours.
        </ThemedText>
      </ThemedView>
    );
  } else {
    // Derived rows are shown the way the web modal shows them: the form, inert,
    // with a link to the transaction they came from. A split instance is not a
    // database row, so it is rebuilt from its source to show that month's slice.
    const instance = isSplitInstance ? splitInstanceOf(transaction, id!) : undefined;
    const shown = instance ?? transaction;
    const parentId = shown.parent_transaction_id ?? shown.split_source_transaction_id ?? null;
    const readOnly = Boolean(shown.bonus_kind) || Boolean(instance);

    const state = formStateFromTransaction(shown, 'edit', (fundId) => {
      const fund = funds.find((f) => f.id === fundId);
      return fund ? { id: fund.id, name: fund.name } : undefined;
    });

    body = (dismiss) => (
      <TransactionForm
        contentSized
        state={state}
        transactionId={readOnly ? undefined : transaction.id}
        disabled={readOnly}
        onViewOriginal={
          readOnly && parentId ? () => router.replace(`/transaction/${parentId}`) : undefined
        }
        note={
          shown.bonus_kind
            ? 'Generated by Trade Republic import — cannot be edited or deleted'
            : undefined
        }
        onDone={dismiss}
      />
    );
  }

  return <TransactionSheet onDismiss={() => router.back()}>{body}</TransactionSheet>;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    minHeight: 180,
  },
  detail: {
    textAlign: 'center',
  },
});
