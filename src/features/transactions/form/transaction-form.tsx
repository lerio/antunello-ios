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
import { Spacing } from '@/constants/theme';
import { hasValidationErrors } from '@/domain/form-validation';
import {
  type FundCategory,
} from '@/domain/types';
import { useCategories } from '@/features/categories/use-categories';
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
import { useFormColors } from '@/hooks/use-form-colors';
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
  /**
   * Shows the form read-only, like the web modal does for a derived row (a split
   * instance or a bonus): every control is inert and Save and Delete are gone.
   */
  disabled?: boolean;
  /** Opens the transaction a derived row came from; shown as a link when set. */
  onViewOriginal?: () => void;
  /** Explains why the row cannot be edited, shown above the link. */
  note?: string;
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
  disabled = false,
  onViewOriginal,
  note,
}: TransactionFormProps) {
  const theme = useTheme();
  const colors = useFormColors();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const { categories, subCategoriesFor } = useCategories();
  const { suggestions, shouldShow } = useTitleSuggestions(form.title);

  const addTransaction = useAddTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  // The external submit is awaited locally rather than read from a mutation,
  // because the caller's write may be several statements long and none of them
  // is a mutation this component can see.
  const [isExternalSaving, setExternalSaving] = useState(false);
  const isSaving = addTransaction.isPending || updateTransaction.isPending || isExternalSaving;
  const isDeleting = deleteTransaction.isPending;
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

  function handleDelete() {
    if (!transactionId) return;

    deleteTransaction
      .mutateAsync(transactionId)
      .then(() => {
        hapticSuccess();
        onDone();
      })
      .catch((error) => {
        hapticError();
        setShowDeleteConfirm(false);
        Alert.alert('Could not delete', messageOf(error));
      });
  }

  const mainCategoryOptions: PickerOption[] = categories.filter(
    (category) =>
      category.type === form.type && category.category !== MONEY_TRANSFER_CATEGORY,
  ).map((category) => ({ value: category.category, label: category.category }));

  // A name can exist as both an income and an expense category; the type picks which.
  const subCategoryOptions: PickerOption[] = subCategoriesFor(
    form.mainCategory,
    form.type,
  ).map((sub) => ({ value: sub, label: sub }));

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
    <Screen
      insetTop={false}
      style={[{ backgroundColor: colors.sheet }, contentSized ? styles.contentSized : null]}>
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
              paddingBottom: contentSized ? Spacing.two : Math.max(insets.bottom, Spacing.three),
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
          <View style={styles.amountRow}>
            <View
              style={[
                styles.amountField,
                styles.fieldShadow,
                { backgroundColor: colors.field, borderColor: colors.fieldBorder },
                disabled && styles.disabled,
              ]}>
              <ThemedText style={[styles.currencySymbol, { color: colors.icon }]}>
                {currencySymbol}
              </ThemedText>
              <TextInput
                value={form.amount}
                onChangeText={(value) => dispatch({ kind: 'setAmount', value })}
                onBlur={() => dispatch({ kind: 'blurAmount' })}
                placeholder="Amount"
                placeholderTextColor={theme.textSecondary}
                editable={!disabled}
                // Not `type=number`: it rejects a comma on some keyboards, and the
                // reducer normalises commas anyway.
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: colors.fieldText }]}
                accessibilityLabel="Amount"
              />
              <Pressable
                onPress={() => setOpenPicker('currency')}
                disabled={disabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Currency: ${form.currency}`}
                style={styles.currencyButton}>
                <ThemedText style={[styles.fieldText, { color: colors.icon }]}>
                  {form.currency}
                </ThemedText>
                <SymbolView name="chevron.down" size={12} tintColor={colors.chevron} />
              </Pressable>
            </View>

            <OptionToggle
              symbol="eye.slash"
              label="Hide from totals"
              checked={!isTransfer && form.hideFromTotals}
              disabled={disabled || isTransfer}
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
              disabled={disabled}
              onChange={(value) => dispatch({ kind: 'setSplitAcrossYear', value })}
            />
          </View>

          {showErrors && form.errors.amount ? (
            <ThemedText themeColor="destructive" style={styles.fieldError}>
              {form.errors.amount}
            </ThemedText>
          ) : null}

          <TypeSelector form={form} dispatch={dispatch} disabled={disabled} />

          {isTransfer ? null : (
            <FieldRow
              placeholder="Select fund"
              value={form.sourceFund?.name}
              disabled={disabled}
              onPress={() => setOpenPicker('fund')}
            />
          )}

          {isTransfer ? null : (
            <View>
              <TextInput
                value={form.title}
                onChangeText={(value) => {
                  setSuggestionsDismissed(false);
                  dispatch({ kind: 'setTitle', value });
                }}
                placeholder="Enter transaction title..."
                placeholderTextColor={theme.textSecondary}
                editable={!disabled}
                style={[
                  styles.titleInput,
                  styles.fieldShadow,
                  {
                    color: colors.fieldText,
                    backgroundColor: colors.field,
                    borderColor: colors.fieldBorder,
                  },
                  disabled && styles.disabled,
                ]}
                accessibilityLabel="Title"
              />
              {showErrors && form.errors.title ? (
                <ThemedText themeColor="destructive" style={styles.fieldError}>
                  {form.errors.title}
                </ThemedText>
              ) : null}
            </View>
          )}

          {!isTransfer && shouldShow && !suggestionsDismissed && suggestions.length > 0 ? (
            <View
              style={[
                styles.suggestions,
                { backgroundColor: colors.field, borderColor: colors.fieldBorder },
              ]}>
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
                    <ThemedText style={{ color: colors.fieldText }} numberOfLines={1}>
                      {suggestion.title}
                    </ThemedText>
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

          {isTransfer ? (
            <>
              <FieldRow
                placeholder="Select source fund"
                value={form.sourceFund?.name}
                error={showErrors ? form.errors.mainCategory : ''}
                disabled={disabled}
                onPress={() => setOpenPicker('sourceFund')}
              />
              <FieldRow
                placeholder="Select target fund"
                value={form.targetFund?.name}
                error={showErrors ? form.errors.subCategory : ''}
                disabled={disabled}
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
                placeholder="Category"
                value={form.mainCategory || undefined}
                marked={form.autoFilled.mainCategory}
                error={showErrors ? form.errors.mainCategory : ''}
                disabled={disabled}
                onPress={() => setOpenPicker('mainCategory')}
              />
              <FieldRow
                placeholder="Sub Category"
                value={form.subCategory || undefined}
                marked={form.autoFilled.subCategory}
                error={showErrors ? form.errors.subCategory : ''}
                disabled={disabled || !form.mainCategory}
                onPress={() => setOpenPicker('subCategory')}
              />
            </>
          )}

          <DateField
            value={form.date}
            disabled={disabled}
            onChange={(value) => dispatch({ kind: 'setDate', value })}
          />

          {showErrors && errorList ? (
            <View
              style={[
                styles.errorSummary,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
              accessibilityRole="alert">
              <View style={styles.errorHeader}>
                <SymbolView name="exclamationmark.circle" size={16} tintColor={colors.errorTitle} />
                <ThemedText style={[styles.errorTitle, { color: colors.errorTitle }]}>
                  Missing required information
                </ThemedText>
              </View>
              {Object.entries(form.errors)
                .filter(([, message]) => message)
                .map(([field, message]) => (
                  <ThemedText key={field} style={[styles.errorItem, { color: colors.errorText }]}>
                    • {message}
                  </ThemedText>
                ))}
            </View>
          ) : null}

          {showDeleteConfirm ? (
            <View style={styles.actions}>
              <ActionButton
                label="Cancel"
                kind="cancel"
                disabled={isDeleting}
                onPress={() => setShowDeleteConfirm(false)}
              />
              <ActionButton
                label="Confirm"
                kind="danger"
                busy={isDeleting}
                onPress={handleDelete}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              {/* Add and edit get a Cancel here; a bank review uses the header's
                  Skip instead, so its Accept button stays full width. */}
              {onSkip ? null : (
                <ActionButton
                  label="Cancel"
                  kind="cancel"
                  disabled={isSaving}
                  onPress={onDone}
                />
              )}
              <ActionButton
                label={submitLabel ?? (transactionId ? 'Save' : 'Add')}
                kind="primary"
                busy={isSaving}
                disabled={disabled}
                onPress={handleSave}
              />
            </View>
          )}

          {onViewOriginal ? (
            <View style={styles.linkGroup}>
              <Pressable
                onPress={onViewOriginal}
                accessibilityRole="button"
                style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
                <ThemedText style={[styles.linkText, { color: theme.text }]}>
                  View Original Transaction
                </ThemedText>
              </Pressable>
              {note ? (
                <ThemedText themeColor="textSecondary" style={styles.linkNote}>
                  {note}
                </ThemedText>
              ) : null}
            </View>
          ) : transactionId && !disabled && !showDeleteConfirm ? (
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={[styles.linkText, { color: colors.link }]}>
                Delete Transaction
              </ThemedText>
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
  disabled,
}: {
  form: FormState;
  dispatch: React.Dispatch<Parameters<typeof formReducer>[1]>;
  disabled: boolean;
}) {
  const colors = useFormColors();

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

        const palette = colors[option.kind];
        const color = 'fgOn' in palette && selected ? palette.fgOn : palette.fg;

        return (
          <Pressable
            key={option.kind}
            disabled={disabled}
            onPress={() => {
              hapticSelect();
              if (option.kind === 'transfer') {
                dispatch({ kind: 'setTransferMode', value: !form.isMoneyTransferMode });
              } else {
                dispatch({ kind: 'setType', value: option.kind });
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.typeButton,
              {
                backgroundColor: selected ? palette.bgOn : palette.bg,
                borderColor: selected ? palette.borderOn : palette.border,
                opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
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
 * Styled like the web's transfer type button, which they share a class with:
 * white with a dark border when on, grey when off. Icon-only; the label is
 * announced by VoiceOver and the switch role exposes the checked state.
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
  const palette = useFormColors().transfer;

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
          backgroundColor: checked ? palette.bgOn : palette.bg,
          borderColor: checked ? palette.borderOn : palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      <SymbolView name={symbol} size={20} tintColor={checked ? palette.fgOn : palette.fg} />
    </Pressable>
  );
}

/**
 * A select field that opens a picker.
 *
 * Like the web's select, the label is the placeholder: it shows in the muted
 * colour until something is chosen, then gives way to the value.
 */
export function FieldRow({
  placeholder,
  value,
  marked,
  error,
  disabled,
  onPress,
}: {
  placeholder: string;
  value?: string;
  /** Shows the blue dot indicating a title suggestion filled this field. */
  marked?: boolean;
  error?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = useFormColors();

  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={value ? `${placeholder}: ${value}` : placeholder}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.fieldRow,
          styles.fieldShadow,
          {
            backgroundColor: colors.field,
            borderColor: colors.fieldBorder,
            opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText
          numberOfLines={1}
          style={[
            styles.fieldText,
            styles.fieldValue,
            { color: value ? colors.fieldText : theme.textSecondary },
          ]}>
          {value ?? placeholder}
        </ThemedText>
        <SymbolView name="chevron.down" size={14} tintColor={colors.chevron} />
      </Pressable>

      {marked ? (
        <View
          style={[styles.autoDot, { backgroundColor: colors.badge }]}
          pointerEvents="none"
        />
      ) : null}

      {error ? (
        <ThemedText themeColor="destructive" style={styles.fieldError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Cancel, Save and the delete confirmation: the web's three big buttons. */
export function ActionButton({
  label,
  kind,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  kind: 'cancel' | 'primary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useFormColors();
  const inert = busy || disabled;

  const background =
    kind === 'cancel' ? colors.field : kind === 'danger' ? colors.confirmBg : colors.saveBg;
  const textColor = kind === 'cancel' ? colors.cancelText : colors.saveText;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => [
        styles.actionButton,
        styles.actionShadow,
        { backgroundColor: background },
        kind === 'cancel' && { borderWidth: 1, borderColor: colors.fieldBorder },
        { opacity: inert ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.actionContent}>
          {kind === 'danger' ? <SymbolView name="trash" size={18} tintColor={textColor} /> : null}
          <ThemedText style={[styles.actionLabel, { color: textColor }]}>{label}</ThemedText>
        </View>
      )}
    </Pressable>
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
  const colors = useFormColors();

  if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return null;

  return (
    <View
      style={[styles.warning, { backgroundColor: colors.noteBg, borderColor: colors.noteBorder }]}>
      <ThemedText style={[styles.warningText, { color: colors.noteText }]}>
        <ThemedText style={[styles.warningText, styles.bold, { color: colors.noteText }]}>
          Note:
        </ThemedText>{' '}
        Amount is in {targetCurrency}. {sourceCurrency} will be converted using the exchange rate
        on the transaction date.
      </ThemedText>
    </View>
  );
}

// Sizes follow the web modal: `h-12` fields (48), `rounded-lg` (8), `text-base`
// (16), `gap-y-3` (12) and `px-4` (16).
const FIELD_HEIGHT = 48;
const FIELD_RADIUS = 8;

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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  // Web `shadow-sm`.
  fieldShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  // Web `shadow-lg`.
  actionShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  errorSummary: {
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    gap: 2,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorItem: {
    fontSize: 14,
    paddingLeft: Spacing.three + Spacing.one,
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
    borderRadius: FIELD_RADIUS,
    borderWidth: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: FIELD_HEIGHT,
    gap: Spacing.two,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
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
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  option: {
    width: FIELD_HEIGHT,
    height: FIELD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FIELD_RADIUS,
    borderWidth: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  fieldText: {
    fontSize: 16,
    lineHeight: 24,
  },
  fieldValue: {
    flex: 1,
  },
  // Web: absolute -top-1 -right-1, 12px, 2px white border.
  autoDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  suggestions: {
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
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
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    padding: 12,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  // Web: py-4 with text-lg.
  actionButton: {
    flex: 1,
    height: 60,
    borderRadius: FIELD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionLabel: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  link: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkGroup: {
    gap: 4,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkNote: {
    fontSize: 12,
    textAlign: 'center',
  },
});
