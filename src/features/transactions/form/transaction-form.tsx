import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useReducer, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PickerSheet, type PickerOption } from '@/components/picker-sheet';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hasValidationErrors } from '@/domain/form-validation';
import {
  CATEGORIES_WITH_TYPES,
  SUB_CATEGORIES,
  type FundCategory,
} from '@/domain/types';
import { useFunds } from '@/features/funds/use-funds';
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
import {
  useAddTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type TransactionInput,
} from '@/features/transactions/mutations';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';
import { hapticError, hapticSelect, hapticSuccess } from '@/lib/haptics';

/** Which sheet is open, if any. */
type OpenPicker =
  | 'currency'
  | 'fund'
  | 'mainCategory'
  | 'subCategory'
  | 'sourceFund'
  | 'targetFund'
  | null;

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
   * Shows a Skip action in the header for a bank import being reviewed.
   *
   * Add and edit are dismissed with the sheet's backdrop or its Cancel button;
   * a review needs an answer for "is this one of yours?", so it gets an
   * explicit button.
   */
  onSkip?: () => void;
  /** Label for that button; defaults to "Skip". Only meaningful with `onSkip`. */
  skipLabel?: string;
  /**
   * Sizes to its content instead of filling the screen.
   *
   * Add and edit sit in a content-sized sheet; the bank review keeps its
   * full-height native modal, where the form must fill the page.
   */
  contentSized?: boolean;
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
  contentSized,
}: TransactionFormProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  // Guards a second tap that lands before the render that disables the button;
  // the render-level `isSaving` alone is too late to stop it.
  const saving = useRef(false);

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

  async function handleSave() {
    if (saving.current) return;

    dispatch({ kind: 'validate' });
    if (!isSubmittable(form)) return;

    saving.current = true;
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
    } finally {
      saving.current = false;
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

  /** A fund picked anywhere in the form is the transaction's `sourceFund`. */
  function selectFund(value: string) {
    const fund = funds.find((candidate) => candidate.id === value);
    if (fund) {
      dispatch({ kind: 'setFund', which: 'source', value: { id: fund.id, name: fund.name } });
    }
  }

  return (
    // No top inset: the sheet starts below the status bar, and the bank review
    // modal's native header supplies its own.
    <Screen insetTop={false} style={contentSized ? styles.contentSized : undefined}>
      {onSkip ? (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <Pressable
                onPress={onSkip}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={skipLabel ?? 'Skip'}>
                <ThemedText style={{ color: theme.tint }}>{skipLabel ?? 'Skip'}</ThemedText>
              </Pressable>
            ),
          }}
        />
      ) : null}

      <KeyboardAvoidingView
        style={contentSized ? styles.contentSized : styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={contentSized ? styles.contentSizedScroll : undefined}
          contentContainerStyle={[
            styles.content,
            {
              // The sheet already pads for the home indicator; the native
              // review modal does not.
              paddingBottom: contentSized ? 0 : Math.max(insets.bottom, Spacing.three),
            },
          ]}
          // Lets iOS inset the scroll view by the keyboard's height, so the
          // lower fields can be scrolled clear of it, and a field focused near
          // the bottom scrolls itself into view.
          automaticallyAdjustKeyboardInsets
          // Tapping a picker or Save while the keyboard is up should do that,
          // not merely dismiss the keyboard first.
          keyboardShouldPersistTaps="handled"
          // Dragging down on the form dismisses the keyboard, which is the
          // expected gesture.
          keyboardDismissMode="interactive">
          {showErrors && errorList ? (
            <View
              style={[styles.errorSummary, { backgroundColor: theme.card }]}
              accessibilityRole="alert">
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

          <View style={styles.amountRow}>
            <View
              style={[
                styles.amountField,
                { backgroundColor: theme.card, borderColor: theme.separator },
              ]}>
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

            <OptionToggle
              symbol="eye.slash"
              label="Hide from totals"
              checked={!isTransfer && form.hideFromTotals}
              disabled={isTransfer}
              hint={
                isTransfer
                  ? 'Money transfers are excluded from totals automatically'
                  : undefined
              }
              onChange={(value) => dispatch({ kind: 'setHideFromTotals', value })}
            />
            <OptionToggle
              symbol="arrow.triangle.branch"
              label="Split across year"
              checked={form.splitAcrossYear}
              onChange={(value) => dispatch({ kind: 'setSplitAcrossYear', value })}
            />
          </View>

          {showErrors && form.errors.amount ? (
            <ThemedText themeColor="destructive" style={styles.fieldError}>
              {form.errors.amount}
            </ThemedText>
          ) : null}

          <TypeSelector form={form} dispatch={dispatch} />

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
            <FieldRow
              label="Select fund"
              value={form.sourceFund?.name ?? 'Select'}
              empty={!form.sourceFund}
              onPress={() => setOpenPicker('fund')}
            />
          )}

          <View>
            <TextInput
              value={form.title}
              onChangeText={(value) => {
                setSuggestionsDismissed(false);
                dispatch({ kind: 'setTitle', value });
              }}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.titleInput,
                {
                  color: theme.text,
                  backgroundColor: theme.card,
                  borderColor: theme.separator,
                },
              ]}
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
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.suggestionMeta}
                      numberOfLines={1}>
                      {suggestion.main_category}
                      {suggestion.sub_category ? ` · ${suggestion.sub_category}` : ''}
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {!isTransfer ? (
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
                label="Sub Category"
                value={form.subCategory || 'Select'}
                empty={!form.subCategory}
                marked={form.autoFilled.subCategory}
                error={showErrors ? form.errors.subCategory : ''}
                disabled={!form.mainCategory}
                onPress={() => setOpenPicker('subCategory')}
              />
            </>
          ) : null}

          <DateField value={form.date} onChange={(value) => dispatch({ kind: 'setDate', value })} />

          <View style={styles.actions}>
            {/* Add and edit get a Cancel here; a bank review uses the header's
                Skip instead, so its Accept button stays full width. */}
            {onSkip ? null : (
              <Pressable
                onPress={onDone}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.cancelButton,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.separator,
                    opacity: isSaving ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText themeColor="textSecondary" style={styles.actionLabel}>
                  Cancel
                </ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: theme.tint, opacity: isSaving ? 0.5 : pressed ? 0.8 : 1 },
              ]}>
              {isSaving ? (
                <ActivityIndicator color={theme.onTint} />
              ) : (
                <ThemedText style={[styles.actionLabel, { color: theme.onTint }]}>
                  {submitLabel ?? (transactionId ? 'Save' : 'Add')}
                </ThemedText>
              )}
            </Pressable>
          </View>

          {transactionId ? (
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText themeColor="destructive">Delete transaction</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

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
        visible={openPicker === 'fund'}
        title="Fund"
        options={fundOptions}
        selected={form.sourceFund?.id ?? null}
        onClose={() => setOpenPicker(null)}
        onSelect={selectFund}
        searchable
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
        title="Sub Category"
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
        onSelect={selectFund}
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

/**
 * Expense, income and transfer, matching the web app's mobile type selector.
 *
 * Three equal icon-only buttons. Expense and income keep their colour in both
 * states — a pale tint when idle, a stronger fill and coloured border when
 * selected — while transfer stays neutral and only darkens its border. The
 * labels are still announced by VoiceOver.
 */
function TypeSelector({
  form,
  dispatch,
}: {
  form: FormState;
  dispatch: React.Dispatch<Parameters<typeof formReducer>[1]>;
}) {
  const theme = useTheme();

  const options = [
    { kind: 'expense' as const, symbol: 'minus.circle' as const, label: 'Expense' },
    { kind: 'income' as const, symbol: 'plus.circle' as const, label: 'Income' },
    {
      kind: 'transfer' as const,
      symbol: 'arrow.left.arrow.right' as const,
      label: 'Money Transfer',
    },
  ];

  return (
    <View style={styles.typeRow}>
      {options.map((option) => {
        const selected = option.kind === 'transfer'
          ? form.isMoneyTransferMode
          : !form.isMoneyTransferMode && form.type === option.kind;

        const color =
          option.kind === 'expense'
            ? theme.expense
            : option.kind === 'income'
              ? theme.income
              : selected
                ? theme.tint
                : theme.textSecondary;

        // The web uses Tailwind's red-50/red-100 (and green equivalents): the
        // same hue at low opacity, stronger when selected.
        const background =
          option.kind === 'transfer'
            ? selected
              ? theme.card
              : theme.backgroundElement
            : `${color}${selected ? '33' : '1A'}`;

        return (
          <Pressable
            key={option.kind}
            onPress={() => {
              hapticSelect();
              if (option.kind === 'transfer') {
                dispatch({ kind: 'setTransferMode', value: !form.isMoneyTransferMode });
              } else {
                dispatch({ kind: 'setType', value: option.kind });
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.typeButton,
              {
                backgroundColor: background,
                borderColor: selected ? color : theme.separator,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <SymbolView name={option.symbol} size={20} tintColor={color} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One of the two compact toggles beside the amount.
 *
 * Icon-only to match the type selector; the label is announced by VoiceOver and
 * the switch role exposes the checked state.
 */
function OptionToggle({
  symbol,
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  symbol: 'eye.slash' | 'arrow.triangle.branch';
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  const tint = checked ? theme.tint : theme.textSecondary;

  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onChange(!checked);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: checked ? theme.backgroundSelected : theme.card,
          borderColor: checked ? theme.tint : theme.separator,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}>
      <SymbolView name={symbol} size={20} tintColor={tint} />
    </Pressable>
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
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={empty ? label : `${label}: ${value}`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.fieldRow,
          {
            backgroundColor: theme.card,
            borderColor: theme.separator,
            opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
          },
        ]}>
        <View style={styles.fieldLabel}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabelText}>
            {label}
          </ThemedText>
          {marked ? <View style={[styles.autoDot, { backgroundColor: theme.tint }]} /> : null}
        </View>
        <View style={styles.fieldValue}>
          {empty ? null : (
            <ThemedText numberOfLines={1}>{value}</ThemedText>
          )}
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Let the sheet measure the form rather than filling the screen.
  contentSized: {
    flex: 0,
  },
  contentSizedScroll: {
    flexGrow: 0,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
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
    // Tailwind's space-x-3 in the web form.
    gap: 12,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    minHeight: 56,
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
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
  option: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  fieldLabelText: {
    fontSize: 15,
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
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.half,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  titleInput: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
