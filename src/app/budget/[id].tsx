import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BudgetForm } from '@/features/budgets/budget-form';
import { useBudgets } from '@/features/budgets/use-budgets';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';

/**
 * Change or remove a budget.
 *
 * The budget is read from the list the previous screen already loaded, so this
 * opens without its own fetch. A cold start straight onto this route — which
 * only a deep link could produce — would find the list empty, and says so rather
 * than rendering a form over a budget that does not exist.
 */
export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items, isLoading } = useBudgets();

  const item = items.find((candidate) => candidate.budget.id === id);

  if (!item) {
    return (
      <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
        <View style={styles.centered}>
          {isLoading ? (
            <ActivityIndicator />
          ) : (
            <ThemedText themeColor="textSecondary">That budget no longer exists.</ThemedText>
          )}
        </View>
      </TransactionSheet>
    );
  }

  return (
    <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
      {(dismiss) => <BudgetForm budget={item.budget} onDone={dismiss} />}
    </TransactionSheet>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
