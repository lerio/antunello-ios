import { useRouter } from 'expo-router';

import { BudgetForm } from '@/features/budgets/budget-form';

/** Set a budget for a category that does not have one yet. */
export default function NewBudgetScreen() {
  const router = useRouter();

  return <BudgetForm budget={null} onDone={() => router.back()} />;
}
