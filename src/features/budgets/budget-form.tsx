import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Budget } from '@/domain/types';
import { useCustomCategories } from '@/features/categories/use-categories';
import { selectableBudgetCategories } from '@/features/budgets/budget-progress';
import { ActionButton, FieldRow } from '@/features/transactions/form/transaction-form';
import { useBudgetMutations, useBudgets } from '@/features/budgets/use-budgets';
import { messageOf } from '@/lib/errors';
import { useFormColors } from '@/hooks/use-form-colors';
import { useTheme } from '@/hooks/use-theme';

type BudgetFormProps = {
  /** The budget being edited, or null when adding. */
  budget: Budget | null;
  onDone: () => void;
};

/**
 * Add or edit a budget.
 *
 * One component for both, as on the web, laid out like the transaction form
 * inside the same bottom sheet. The category is fixed once set — moving a budget to a category that already has
 * one would leave two competing for the same spending — and that editing offers
 * a delete.
 */
export function BudgetForm({ budget, onDone }: BudgetFormProps) {
  const theme = useTheme();
  const colors = useFormColors();
  const isEdit = budget !== null;

  const { takenCategories } = useBudgets();
  const { addBudget, updateBudget, deleteBudget } = useBudgetMutations();

  const [category, setCategory] = useState(budget?.category ?? '');
  const [amount, setAmount] = useState(budget ? String(budget.amount) : '');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom categories feed the options below; they are memoised on this.
  const { data: customCategories } = useCustomCategories();
  const categoryOptions = useMemo(
    () =>
      selectableBudgetCategories(takenCategories, budget?.category).map((name) => ({
        value: name,
        label: name,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [takenCategories, budget?.category, customCategories],
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

  async function handleDelete() {
    if (!budget) return;

    try {
      await deleteBudget.mutateAsync(budget.id);
      onDone();
    } catch (err) {
      setError(messageOf(err));
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // No automaticallyAdjustKeyboardInsets: the sheet lifts itself above the
          // keyboard, and insetting the scroll view as well left a keyboard-sized gap.
          >
          <FieldRow
            placeholder="Category"
            value={category || undefined}
            disabled={isEdit || isBusy}
            onPress={() => setPickerOpen(true)}
          />

          <View
            style={[
              styles.amountField,
              { backgroundColor: colors.field, borderColor: colors.fieldBorder },
            ]}>
            <ThemedText style={[styles.currencySymbol, { color: colors.icon }]}>{'€'}</ThemedText>
            <TextInput
              value={amount}
              onChangeText={(next) => setAmount(next.replace(',', '.').replace(/[^0-9.]/g, ''))}
              placeholder="Monthly limit"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              editable={!isBusy}
              style={[styles.amountInput, { color: colors.fieldText }]}
              accessibilityLabel="Monthly limit"
            />
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
              accessibilityRole="alert">
              <SymbolView name="exclamationmark.circle" size={16} tintColor={colors.errorTitle} />
              <ThemedText style={[styles.errorText, { color: colors.errorTitle }]}>{error}</ThemedText>
            </View>
          ) : null}

          {showDeleteConfirm ? (
            <View style={styles.actions}>
              <ActionButton
                label="Cancel"
                kind="cancel"
                disabled={deleteBudget.isPending}
                onPress={() => setShowDeleteConfirm(false)}
              />
              <ActionButton
                label="Confirm"
                kind="danger"
                busy={deleteBudget.isPending}
                onPress={handleDelete}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <ActionButton label="Cancel" kind="cancel" disabled={isBusy} onPress={onDone} />
              <ActionButton
                label={isEdit ? 'Save' : 'Add'}
                kind="primary"
                busy={addBudget.isPending || updateBudget.isPending}
                disabled={isBusy}
                onPress={handleSave}
              />
            </View>
          )}

          {isEdit && !showDeleteConfirm ? (
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={[styles.linkText, { color: colors.link }]}>Delete Budget</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>

      <PickerSheet
        visible={isPickerOpen}
        title="Category"
        options={categoryOptions}
        selected={category === '' ? null : category}
        onSelect={setCategory}
        onClose={() => setPickerOpen(false)}
        searchable
      />
    </>
  );
}

const FIELD_HEIGHT = 48;
const FIELD_RADIUS = 8;

// Dimensions mirror the transaction form's, so the two sheets read as one family.
const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 12,
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: FIELD_HEIGHT,
    gap: Spacing.two,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  currencySymbol: {
    fontSize: 16,
    lineHeight: 24,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    height: FIELD_HEIGHT,
    fontVariant: ['tabular-nums'],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  link: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
