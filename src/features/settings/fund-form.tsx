import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/domain/app-constants';
import { TOP_LEVEL_FUND_CATEGORIES, type FundCategory } from '@/domain/types';
import type { FundDraft } from '@/features/settings/use-fund-categories';
import { ActionButton, FieldRow } from '@/features/transactions/form/transaction-form';
import { useFormColors } from '@/hooks/use-form-colors';
import { useTheme } from '@/hooks/use-theme';

const categoryOptions = [
  { value: '', label: 'No Category' },
  ...TOP_LEVEL_FUND_CATEGORIES.map((c) => ({ value: c, label: c })),
];
const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

type FundFormProps = {
  /** The fund being edited; omit to add. */
  fund?: FundCategory;
  /** Saves the fund; may throw to show a message in the form. */
  onSubmit: (draft: FundDraft) => Promise<void>;
  /** Edit only; may throw to show a message in the form. */
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

/**
 * Add or edit a fund, laid out like the transaction and budget sheets.
 *
 * Editing offers a "Delete Fund" link that turns into Cancel / Confirm in place.
 */
export function FundForm({ fund, onSubmit, onDelete, onClose }: FundFormProps) {
  const theme = useTheme();
  const colors = useFormColors();
  const isEdit = fund !== undefined;

  const [name, setName] = useState(fund?.name ?? '');
  const [topLevel, setTopLevel] = useState(fund?.top_level_category ?? '');
  const [currency, setCurrency] = useState(fund?.currency ?? 'EUR');
  const [amount, setAmount] = useState(fund ? String(fund.amount) : '');
  const [description, setDescription] = useState(fund?.description ?? '');
  const [isActive, setIsActive] = useState(fund?.is_active ?? true);
  const [picker, setPicker] = useState<'category' | 'currency' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const busy = isSaving || isDeleting;

  async function handleSave() {
    const parsed = Number.parseFloat(amount.replace(',', '.'));
    if (!name.trim()) return setError('Name is required');
    if (Number.isNaN(parsed)) return setError('Initial amount is required');

    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        currency,
        amount: parsed,
        is_active: isActive,
        top_level_category: topLevel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete fund');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.field, borderColor: colors.fieldBorder, color: colors.fieldText },
  ];

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
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
            editable={!busy}
            accessibilityLabel="Name"
            style={inputStyle}
          />

          <FieldRow
            placeholder="Top level category"
            value={topLevel || 'No Category'}
            disabled={busy}
            onPress={() => setPicker('category')}
          />
          <FieldRow
            placeholder="Currency"
            value={currency}
            disabled={busy}
            onPress={() => setPicker('currency')}
          />

          <TextInput
            value={amount}
            onChangeText={(next) => setAmount(next.replace(',', '.'))}
            placeholder="Initial amount"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            editable={!busy}
            accessibilityLabel="Initial amount"
            style={inputStyle}
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textSecondary}
            editable={!busy}
            accessibilityLabel="Description"
            style={inputStyle}
          />

          <View
            style={[
              styles.activeRow,
              { backgroundColor: colors.field, borderColor: colors.fieldBorder },
            ]}>
            <ThemedText style={[styles.activeLabel, { color: colors.fieldText }]}>Active</ThemedText>
            <Switch value={isActive} onValueChange={setIsActive} disabled={busy} />
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
                disabled={isDeleting}
                onPress={() => setShowDeleteConfirm(false)}
              />
              <ActionButton label="Confirm" kind="danger" busy={isDeleting} onPress={handleDelete} />
            </View>
          ) : (
            <View style={styles.actions}>
              <ActionButton label="Cancel" kind="cancel" disabled={busy} onPress={onClose} />
              <ActionButton
                label={isEdit ? 'Save' : 'Add'}
                kind="primary"
                busy={isSaving}
                disabled={busy}
                onPress={handleSave}
              />
            </View>
          )}

          {isEdit && onDelete && !showDeleteConfirm ? (
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={[styles.linkText, { color: colors.link }]}>Delete Fund</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>

      <PickerSheet
        visible={picker === 'category'}
        title="Top Level Category"
        options={categoryOptions}
        selected={topLevel}
        onSelect={setTopLevel}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'currency'}
        title="Currency"
        options={currencyOptions}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

const FIELD_HEIGHT = 48;
const FIELD_RADIUS = 8;

// Dimensions mirror the transaction form's, so the sheets read as one family.
const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 12,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  activeLabel: {
    fontSize: 16,
    lineHeight: 24,
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
