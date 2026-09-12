import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getCurrencySymbol } from '@/domain/app-constants';
import type { Budget } from '@/domain/types';
import { selectableBudgetCategories } from '@/features/budgets/budget-progress';
import { useBudgetMutations, useBudgets } from '@/features/budgets/use-budgets';
import { messageOf } from '@/lib/errors';
import { useTheme } from '@/hooks/use-theme';

type BudgetFormProps = {
  /** The budget being edited, or null when adding. */
  budget: Budget | null;
  onDone: () => void;
};

/**
 * Add or edit a budget.
 *
 * One component for both, as on the web: the only differences are that the
 * category is fixed once set — moving a budget to a category that already has
 * one would leave two competing for the same spending — and that editing offers
 * a delete.
 */
export function BudgetForm({ budget, onDone }: BudgetFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const isEdit = budget !== null;

  const { takenCategories } = useBudgets();
  const { addBudget, updateBudget, deleteBudget } = useBudgetMutations();

  const [category, setCategory] = useState(budget?.category ?? '');
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () =>
      selectableBudgetCategories(takenCategories, budget?.category).map((name) => ({
        value: name,
        label: name,
      })),
    [takenCategories, budget?.category],
  );

  const parsedAmount = Number(amount.trim());
  const isValid = category !== '' && amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const isBusy = addBudget.isPending || updateBudget.isPending || deleteBudget.isPending;

  async function handleSave() {
    setError(null);

    if (category === '') {
      setError('Pick a category.');
      return;
    }
    if (!isValid) {
      setError('The limit must be more than zero.');
      return;
    }

    try {
      if (budget) await updateBudget.mutateAsync({ id: budget.id, amount: parsedAmount });
      else await addBudget.mutateAsync({ category, amount: parsedAmount });
      onDone();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function handleDelete() {
    if (!budget) return;

    Alert.alert('Delete this budget?', `${budget.category} will no longer be tracked.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget.mutateAsync(budget.id);
            onDone();
          } catch (err) {
            setError(messageOf(err));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          {isEdit ? (
            <View style={styles.field}>
              <ThemedText themeColor="textSecondary" style={styles.label}>
                Category
              </ThemedText>
              <ThemedText style={styles.categoryName}>{budget.category}</ThemedText>
            </View>
          ) : (
            <View style={styles.field}>
              <ThemedText themeColor="textSecondary" style={styles.label}>
                Category
              </ThemedText>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose a category"
                style={({ pressed }) => [
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.separator,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}>
                <ThemedText
                  themeColor={category === '' ? 'textSecondary' : 'text'}
                  style={styles.inputText}
                  numberOfLines={1}>
                  {category === '' ? 'Select a category' : category}
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.field}>
            <ThemedText themeColor="textSecondary" style={styles.label}>
              Monthly limit
            </ThemedText>
            <View
              style={[
                styles.input,
                styles.amountRow,
                { backgroundColor: theme.card, borderColor: theme.separator },
              ]}>
              <ThemedText themeColor="textSecondary" style={styles.currency}>
                {getCurrencySymbol('EUR')}
              </ThemedText>
              <TextInput
                value={amount}
                onChangeText={(next) => setAmount(next.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                inputMode="decimal"
                style={[styles.amountInput, { color: theme.text }]}
                accessibilityLabel="Monthly limit"
              />
            </View>
          </View>

          {error ? (
            <ThemedText themeColor="destructive" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.back()}
              disabled={isBusy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: theme.backgroundElement,
                  opacity: pressed || isBusy ? 0.6 : 1,
                },
              ]}>
              <ThemedText style={styles.buttonLabel}>Cancel</ThemedText>
            </Pressable>

            {isEdit ? (
              <Pressable
                onPress={handleDelete}
                disabled={isBusy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.backgroundElement, opacity: pressed || isBusy ? 0.6 : 1 },
                ]}>
                <ThemedText themeColor="destructive" style={styles.buttonLabel}>
                  Delete
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleSave}
              disabled={!isValid || isBusy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                {
                  backgroundColor: theme.tint,
                  opacity: !isValid || isBusy ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}>
              {isBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={[styles.buttonLabel, styles.primaryLabel]}>
                  {isEdit ? 'Save' : 'Create'}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={isPickerOpen}
        title="Category"
        options={categoryOptions}
        selected={category === '' ? null : category}
        onSelect={setCategory}
        onClose={() => setPickerOpen(false)}
        searchable
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputText: {
    flex: 1,
    fontSize: 17,
  },
  amountRow: {
    gap: Spacing.one,
  },
  currency: {
    fontSize: 17,
  },
  amountInput: {
    flex: 1,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  error: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  primary: {},
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  primaryLabel: {
    color: '#ffffff',
  },
});
