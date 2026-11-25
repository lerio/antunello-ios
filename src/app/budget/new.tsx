import { useRouter } from 'expo-router';

import { BudgetForm } from '@/features/budgets/budget-form';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';

/** Set a budget for a category that does not have one yet, in a content-sized sheet. */
export default function NewBudgetScreen() {
  const router = useRouter();

  return (
    <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
      {(dismiss) => <BudgetForm budget={null} onDone={dismiss} />}
    </TransactionSheet>
  );
}
