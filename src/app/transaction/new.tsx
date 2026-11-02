import { useRouter } from 'expo-router';

import { TransactionForm } from '@/features/transactions/form/transaction-form';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';
import { initialFormState } from '@/features/transactions/form/reducer';

/**
 * Add a transaction.
 *
 * Presented as a content-sized sheet over the tabs, which is the native
 * equivalent of the web app's add modal.
 */
export default function NewTransactionScreen() {
  const router = useRouter();

  return (
    <TransactionSheet onDismiss={() => router.back()}>
      <TransactionForm
        contentSized
        state={initialFormState('add')}
        onDone={() => router.back()}
      />
    </TransactionSheet>
  );
}
