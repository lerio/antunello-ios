import { useRouter } from 'expo-router';

import { TransactionForm } from '@/features/transactions/form/transaction-form';
import { initialFormState } from '@/features/transactions/form/reducer';

/**
 * Add a transaction.
 *
 * Presented as a full-screen modal rather than a tab child, so it covers the
 * tab bar — the native equivalent of the web app hiding its bottom nav on the
 * add and edit routes.
 */
export default function NewTransactionScreen() {
  const router = useRouter();

  return (
    <TransactionForm state={initialFormState('add')} onDone={() => router.back()} />
  );
}
