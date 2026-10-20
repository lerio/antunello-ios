import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { PickerSheet, type PickerOption } from '@/components/picker-sheet';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hasValidationErrors } from '@/domain/form-validation';
import { messageOf } from '@/lib/errors';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import {
  CATEGORIES_WITH_TYPES,
  SUB_CATEGORIES,
  type FundCategory,
} from '@/domain/types';
import { useFunds } from '@/features/funds/use-funds';
import {
  useAddTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type TransactionInput,
} from '@/features/transactions/mutations';
import { DateField } from '@/features/transactions/form/date-field';
import {
  MONEY_TRANSFER_CATEGORY,
  TRANSACTION_CURRENCIES,
  formReducer,
  isSubmittable,
  type FormState,
  type TransactionCurrency,
} from '@/features/transactions/form/reducer';
import { toInput } from '@/features/transactions/form/to-input';
import { useTitleSuggestions } from '@/features/transactions/form/use-title-suggestions';
import { useTheme } from '@/hooks/use-theme';

/** Which sheet is open, if any. */
type OpenPicker = 'currency' | 'mainCategory' | 'subCategory' | 'sourceFund' | 'targetFund' | null;

type TransactionFormProps = {
  state: FormState;
  /** Called after a successful save or delete. */
  onDone: () => void;
  /** The id being edited, absent when creating. */
  transactionId?: string;
  /**
   * Saves the transaction somewhere other than the transaction table.
   *
   * Reviewing a bank import is not an insert: the row is written, its bonuses
   * are built and written, and the pending row is closed — and if any of that
   * fails it is rolled back. The form still owns the fields and the validation
   * for it, exactly as on the web, where the modal takes the same `onSubmit`
   * override. Supplying this replaces the built-in add/update entirely.
   */
  onSubmit?: (input: TransactionInput) => Promise<void>;
  /** Label for the submit button; defaults to the add/update wording. */
  submitLabel?: string;
  /**
   * Replaces the Cancel button, and skips the "discard?" confirmation.
   *
   * Skipping a bank import is a decision the user is making rather than work
   * they are abandoning, so asking them to confirm it would be asking twice.
   */
  onSkip?: () => void;
  /** Label for that button; only meaningful alongside `onSkip`. */
  skipLabel?: string;
};

/**
 * Create, edit or review a transaction.
 *
 * The three entry modes share one form because they differ only in their initial
 * state and what happens on save — the fields, their cascade rules and their
 * validation are identical, and the web app keeps them in one component for the
 * same reason.
 *
 * A transfer is a mode rather than a type, so the two fund pickers replace the
 * two category pickers in place, using the same error slots. See `reducer.ts`.
 */
export function TransactionForm({
  state,
  onDone,
  transactionId,
  onSubmit,
  submitLabel,
  onSkip,
  skipLabel,
}: TransactionFormProps) {
  const theme = useTheme();
  const [form, dispatch] = useReducer(formReducer, state);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  /**
   * Whether the suggestion list is hidden, cleared as soon as the title changes.
   *
   * Set in two situations:
   *
   *  - **On opening.** A prefilled title — every edit, and any pending
   *    transaction being reviewed — is already long enough to match, so the list
   *    would be open before the user has done anything. The web app's dropdown
   *    starts closed and opens only on input, which is the behaviour this
   *    reproduces.
   *  - **After picking.** The chosen suggestion still matches its own text, so
   *    the list would immediately reopen over the form.
   */
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(
    state.title.trim().length > 0,
  );

  const { data: funds = [] } = useFunds();
  const { suggestions, shouldShow } = useTitleSuggestions(form.title);

  const addTransaction = useAddTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  // The external submit is awaited locally rather than read from a mutation,
  // because the caller's write may be several statements long and none of them
  // is a mutation this component can see.
  const [isExternalSaving, setExternalSaving] = useState(false);
  const isSaving = addTransaction.isPending || updateTransaction.isPending || isExternalSaving;
  const isTransfer = form.isMoneyTransferMode;
  const showErrors = form.hasAttemptedSubmit;
  const errorList = hasValidationErrors(form.errors);

  const currencySymbol = { EUR: '€', USD: '$', JPY: '¥' }[form.currency];

  // The state as it was on opening, captured once. A ref rather than a
  // comparison against the `state` prop, because the add screen builds that
  // prop afresh on every render — including a new `Date` — so comparing against
  // it would report every untouched form as dirty.
  const initialState = useRef(form);

  /**
   * Cancels, asking first if anything has been entered.
   *
   * The confirmation is only worth showing when there is work to lose; asking
   * on an untouched form is friction for no reason.
   */
  function handleCancel() {
    // A skip is a decision, not an abandonment — it is the answer to "is this
    // one of yours?", so it goes straight through.
    if (onSkip) {
      onSkip();
      return;
    }

    if (!hasChanges(form, initialState.current)) {
      onDone();
      return;
    }

    Alert.alert('Discard this transaction?', 'What you have entered will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDone },
    ]);
  }

  async function handleSave() {
    dispatch({ kind: 'validate' });
    if (!isSubmittable(form)) return;

    const input = toInput(form);

    try {
      if (onSubmit) {
        setExternalSaving(true);
        try {
          await onSubmit(input);
        } finally {
          setExternalSaving(false);
        }
      } else if (transactionId) {
        await updateTransaction.mutateAsync({ id: transactionId, changes: input });
      } else {
        await addTransaction.mutateAsync(input);
      }
      hapticSuccess();
      onDone();
    } catch (error) {
      // Logged as well as alerted: the alert can only show a string, and the
      // original carries fields an alert cannot.
      console.error('Transaction save failed:', error);
      hapticError();
      Alert.alert('Could not save', messageOf(error));
    }
  }

  function confirmDelete() {
    if (!transactionId) return;

    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTransaction
            .mutateAsync(transactionId)
            .then(() => {
              hapticSuccess();
              onDone();
            })
            .catch((error) => {
              hapticError();
              Alert.alert('Could not delete', messageOf(error));
            });
        },
      },
    ]);
  }

  const mainCategoryOptions: PickerOption[] = CATEGORIES_WITH_TYPES.filter(
    (category) =>
      category.type === form.type && category.category !== MONEY_TRANSFER_CATEGORY,
  ).map((category) => ({ value: category.category, label: category.category }));

  const subCategoryOptions: PickerOption[] = (SUB_CATEGORIES[form.mainCategory] ?? []).map(
    (sub) => ({ value: sub, label: sub }),
  );

  const fundOptions: PickerOption[] = funds.map((fund: FundCategory) => ({
    value: fund.id,
    label: fund.name,
    detail: fund.currency,
    group: fund.top_level_category ?? undefined,
  }));

  return (
    // No top inset: this is presented as a modal with a header, and the header
    // already clears the status bar. Insetting again would double the gap.
    <Screen insetTop={false}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handleCancel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={skipLabel ?? 'Cancel'}>
              <ThemedText style={{ color: theme.tint }}>{skipLabel ?? 'Cancel'}</ThemedText>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        // Lets iOS inset the scroll view by the keyboard's height, so the lower
        // fields and the save button can be scrolled clear of it, and a field
        // focused near the bottom scrolls itself into view. Without this the
        // keyboard simply covers the bottom of the form.
        automaticallyAdjustKeyboardInsets
        // Tapping a picker or Save while the keyboard is up should do that, not
        // merely dismiss the keyboard first.
        keyboardShouldPersistTaps="handled"
        // Dragging down on the form dismisses the keyboard, which is the
        // expected gesture and also stops a scroll from fighting the sheet's
        // swipe-to-dismiss.
        keyboardDismissMode="interactive">
        {showErrors && errorList ? (
          <View style={[styles.errorSummary, { backgroundColor: theme.card }]} accessibilityRole="alert">
            <ThemedText themeColor="destructive" style={styles.errorTitle}>
              Missing required information
            </ThemedText>
            {Object.entries(form.errors)
              .filter(([, message]) => message)
              .map(([field, message]) => (
                <ThemedText key={field} themeColor="destructive" style={styles.errorItem}>
                  • {message}
                </ThemedText>
              ))}
          </View>
        ) : null}

        <TypeSelector form={form} dispatch={dispatch} />

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.amountRow}>
            <ThemedText style={styles.currencySymbol}>{currencySymbol}</ThemedText>
            <TextInput
              value={form.amount}
              onChangeText={(value) => dispatch({ kind: 'setAmount', value })}
              onBlur={() => dispatch({ kind: 'blurAmount' })}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              // Not `type=number`: it rejects a comma on some keyboards, and the
              // reducer normalises commas anyway.
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: theme.text }]}
              accessibilityLabel="Amount"
            />
            <Pressable
              onPress={() => setOpenPicker('currency')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Currency: ${form.currency}`}
              style={styles.currencyButton}>
              <ThemedText style={{ color: theme.tint }}>{form.currency}</ThemedText>
              <SymbolView name="chevron.up.chevron.down" size={11} tintColor={theme.tint} />
            </Pressable>
          </View>

          {showErrors && form.errors.amount ? (
            <ThemedText themeColor="destructive" style={styles.fieldError}>
              {form.errors.amount}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ToggleRow
            label="Hide from totals"
            detail={isTransfer ? 'Not available for transfers' : undefined}
            value={isTransfer ? false : form.hideFromTotals}
            disabled={isTransfer}
            onChange={(value) => dispatch({ kind: 'setHideFromTotals', value })}
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <ToggleRow
            label="Split across year"
            value={form.splitAcrossYear}
            onChange={(value) => dispatch({ kind: 'setSplitAcrossYear', value })}
          />
        </View>

        {isTransfer ? (
          <>
            <FieldRow
              label="From fund"
              value={form.sourceFund?.name ?? 'Select'}
              empty={!form.sourceFund}
              error={showErrors ? form.errors.mainCategory : ''}
              onPress={() => setOpenPicker('sourceFund')}
            />
            <FieldRow
              label="To fund"
              value={form.targetFund?.name ?? 'Select'}
              empty={!form.targetFund}
              error={showErrors ? form.errors.subCategory : ''}
              onPress={() => setOpenPicker('targetFund')}
            />

            {form.sourceFund && form.targetFund ? (
              <TransferWarning
                sourceCurrency={funds.find((f) => f.id === form.sourceFund?.id)?.currency}
                targetCurrency={funds.find((f) => f.id === form.targetFund?.id)?.currency}
              />
            ) : null}
          </>
        ) : (
          <>
            <FieldRow
              label="Category"
              value={form.mainCategory || 'Select'}
              empty={!form.mainCategory}
              marked={form.autoFilled.mainCategory}
              error={showErrors ? form.errors.mainCategory : ''}
              onPress={() => setOpenPicker('mainCategory')}
            />
            <FieldRow
              label="Subcategory"
              value={form.subCategory || 'Select'}
              empty={!form.subCategory}
              marked={form.autoFilled.subCategory}
              error={showErrors ? form.errors.subCategory : ''}
              disabled={!form.mainCategory}
              onPress={() => setOpenPicker('subCategory')}
            />
          </>
        )}

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <TextInput
            value={form.title}
            onChangeText={(value) => {
              setSuggestionsDismissed(false);
              dispatch({ kind: 'setTitle', value });
            }}
            placeholder="Title"
            placeholderTextColor={theme.textSecondary}
            style={[styles.titleInput, { color: theme.text }]}
            accessibilityLabel="Title"
          />
          {showErrors && form.errors.title ? (
            <ThemedText themeColor="destructive" style={styles.fieldError}>
              {form.errors.title}
            </ThemedText>
          ) : null}
        </View>

        {shouldShow && !suggestionsDismissed && suggestions.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {suggestions.map((suggestion, index) => (
              <View key={suggestion.id}>
                {index > 0 ? (
                  <View style={[styles.divider, { backgroundColor: theme.separator }]} />
                ) : null}
                <Pressable
                  onPress={() => {
                    setSuggestionsDismissed(true);
                    dispatch({ kind: 'applySuggestion', value: suggestion });
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.suggestion,
                    { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
                  ]}>
                  <ThemedText numberOfLines={1}>{suggestion.title}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.suggestionMeta} numberOfLines={1}>
                    {suggestion.main_category}
                    {suggestion.sub_category ? ` · ${suggestion.sub_category}` : ''}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <DateField value={form.date} onChange={(value) => dispatch({ kind: 'setDate', value })} />

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.tint, opacity: isSaving ? 0.5 : pressed ? 0.8 : 1 },
          ]}>
          {isSaving ? (
            <ActivityIndicator color={theme.onTint} />
          ) : (
            <ThemedText style={[styles.saveLabel, { color: theme.onTint }]}>
              {submitLabel ?? (transactionId ? 'Save changes' : 'Add transaction')}
            </ThemedText>
          )}
        </Pressable>

        {transactionId ? (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText themeColor="destructive">Delete transaction</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      <PickerSheet
        visible={openPicker === 'currency'}
        title="Currency"
        options={TRANSACTION_CURRENCIES.map((code) => ({ value: code, label: code }))}
        selected={form.currency}
        onClose={() => setOpenPicker(null)}
        onSelect={(value) =>
          dispatch({ kind: 'setCurrency', value: value as TransactionCurrency })
        }
      />

      <PickerSheet
        visible={openPicker === 'mainCategory'}
        title="Category"
        options={mainCategoryOptions}
        selected={form.mainCategory}
        onClose={() => setOpenPicker(null)}
        onSelect={(value) => dispatch({ kind: 'setMainCategory', value })}
        searchable
      />

      <PickerSheet
        visible={openPicker === 'subCategory'}
        title="Subcategory"
        options={subCategoryOptions}
        selected={form.subCategory}
        onClose={() => setOpenPicker(null)}
        onSelect={(value) => dispatch({ kind: 'setSubCategory', value })}
      />

      <PickerSheet
        visible={openPicker === 'sourceFund'}
        title="From fund"
        options={fundOptions.map((option) => ({
          ...option,
          // A fund cannot transfer to itself.
          disabled: option.value === form.targetFund?.id,
        }))}
        selected={form.sourceFund?.id ?? null}
        onClose={() => setOpenPicker(null)}
        onSelect={(value) => {
          const fund = funds.find((f) => f.id === value);
          if (fund) dispatch({ kind: 'setFund', which: 'source', value: { id: fund.id, name: fund.name } });
        }}
        searchable
      />

      <PickerSheet
        visible={openPicker === 'targetFund'}
        title="To fund"
        options={fundOptions.map((option) => ({
          ...option,
          disabled: option.value === form.sourceFund?.id,
        }))}
        selected={form.targetFund?.id ?? null}
        onClose={() => setOpenPicker(null)}
        onSelect={(value) => {
          const fund = funds.find((f) => f.id === value);
          if (fund) dispatch({ kind: 'setFund', which: 'target', value: { id: fund.id, name: fund.name } });
        }}
        searchable
      />
    </Screen>
  );
}

/** Expense, income and transfer, as three mutually exclusive buttons. */
function TypeSelector({
  form,
  dispatch,
}: {
  form: FormState;
  dispatch: React.Dispatch<Parameters<typeof formReducer>[1]>;
}) {
  const theme = useTheme();

  const options = [
    { kind: 'expense' as const, symbol: 'minus.circle.fill' as const, label: 'Expense' },
    { kind: 'income' as const, symbol: 'plus.circle.fill' as const, label: 'Income' },
    { kind: 'transfer' as const, symbol: 'arrow.left.arrow.right.circle.fill' as const, label: 'Transfer' },
  ];

  return (
    <View style={styles.typeRow}>
      {options.map((option) => {
        const selected = option.kind === 'transfer'
          ? form.isMoneyTransferMode
          : !form.isMoneyTransferMode && form.type === option.kind;

        const tint = selected
          ? option.kind === 'expense'
            ? theme.expense
            : option.kind === 'income'
              ? theme.income
              : theme.transfer
          : theme.textSecondary;

        return (
          <Pressable
            key={option.kind}
            onPress={() =>
              option.kind === 'transfer'
                ? dispatch({ kind: 'setTransferMode', value: !form.isMoneyTransferMode })
                : dispatch({ kind: 'setType', value: option.kind })
            }
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.typeButton,
              {
                backgroundColor: selected ? theme.backgroundElement : theme.card,
                borderColor: selected ? tint : theme.separator,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <SymbolView name={option.symbol} size={22} tintColor={tint} />
            <ThemedText style={[styles.typeLabel, { color: tint }]}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled row that opens a picker. */
function FieldRow({
  label,
  value,
  empty,
  marked,
  error,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  empty: boolean;
  /** Shows the blue dot indicating a title suggestion filled this field. */
  marked?: boolean;
  error?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => [
          styles.fieldRow,
          { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        ]}>
        <View style={styles.fieldLabel}>
          <ThemedText>{label}</ThemedText>
          {marked ? <View style={[styles.autoDot, { backgroundColor: theme.tint }]} /> : null}
        </View>
        <View style={styles.fieldValue}>
          <ThemedText themeColor={empty ? 'textSecondary' : 'text'} numberOfLines={1}>
            {value}
          </ThemedText>
          <SymbolView name="chevron.right" size={12} tintColor={theme.textSecondary} />
        </View>
      </Pressable>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.fieldError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  disabled,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLabel}>
        <ThemedText>{label}</ThemedText>
        {detail ? (
          <ThemedText themeColor="textSecondary" style={styles.toggleDetail}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

/**
 * Warns when a transfer crosses currencies.
 *
 * The amount is entered in the *target* fund's currency, which is not obvious
 * and changes what the number means. The web app shows the same warning.
 */
function TransferWarning({
  sourceCurrency,
  targetCurrency,
}: {
  sourceCurrency?: string;
  targetCurrency?: string;
}) {
  const theme = useTheme();

  if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return null;

  return (
    <View style={[styles.warning, { backgroundColor: theme.card }]}>
      <SymbolView name="exclamationmark.triangle" size={15} tintColor={theme.warning} />
      <ThemedText themeColor="textSecondary" style={styles.warningText}>
        Amount is in {targetCurrency}. {sourceCurrency} will be converted using the exchange rate
        on the transaction date.
      </ThemedText>
    </View>
  );
}

/**
 * Whether anything has been entered since the form opened.
 *
 * Compares only the fields a user can change, ignoring validation errors and the
 * auto-fill markers — those follow from the fields and would otherwise make an
 * untouched form look edited.
 *
 * @param form The current state.
 * @param initial The state as it was on opening.
 */
function hasChanges(form: FormState, initial: FormState): boolean {
  return (
    form.type !== initial.type ||
    form.isMoneyTransferMode !== initial.isMoneyTransferMode ||
    form.amount.trim() !== initial.amount.trim() ||
    form.currency !== initial.currency ||
    form.title.trim() !== initial.title.trim() ||
    form.mainCategory !== initial.mainCategory ||
    form.subCategory !== initial.subCategory ||
    form.hideFromTotals !== initial.hideFromTotals ||
    form.splitAcrossYear !== initial.splitAcrossYear ||
    form.sourceFund?.id !== initial.sourceFund?.id ||
    form.targetFund?.id !== initial.targetFund?.id ||
    form.date.getTime() !== initial.date.getTime()
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  errorSummary: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  errorTitle: {
    fontWeight: '600',
  },
  errorItem: {
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    minHeight: 56,
    gap: Spacing.two,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 30,
    // Set alongside the size rather than left to the default, which would clip
    // the digits' ascent the way the Balance total was clipped.
    lineHeight: 38,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: Spacing.two,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  autoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  fieldError: {
    fontSize: 12,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  toggleLabel: {
    flex: 1,
    gap: 1,
  },
  toggleDetail: {
    fontSize: 12,
  },
  titleInput: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  suggestion: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 1,
  },
  suggestionMeta: {
    fontSize: 12,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    height: 50,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  saveLabel: {
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
