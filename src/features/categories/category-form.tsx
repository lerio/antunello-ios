import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { lucideIconByName } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { IconPickerSheet } from '@/features/categories/icon-picker-sheet';
import type { CategoryType } from '@/features/categories/registry';
import { ActionButton } from '@/features/transactions/form/transaction-form';
import { useFormColors } from '@/hooks/use-form-colors';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelect } from '@/lib/haptics';

type CategoryFormProps = {
  /** Set for a subcategory (new or existing): its main category's name, shown above the title. */
  parentTitle?: string;
  /** The type for a new main category; a subcategory is locked to its parent's. */
  type?: CategoryType;
  /** Set when editing: the existing title. Omit to add. */
  initialTitle?: string;
  /** Editing a main category: its icon's Lucide name. */
  initialIcon?: string;
  /** Editing the one movement category (Money Transfer), whose type shows as Movement. */
  isMovement?: boolean;
  /** Editing: how many transactions use it; hidden while loading. */
  transactionCount?: number;
  /** Editing: whether nothing depends on the category, so it may be deleted. */
  canDelete?: boolean;
  onDelete?: () => void;
  /** Saves the category; may throw to show a message in the form. */
  onSubmit: (values: { title: string; type: CategoryType; icon: string }) => Promise<void>;
  onClose: () => void;
};

/**
 * Add or edit a main category or a subcategory, laid out like the other sheets.
 *
 * The type is shown with the transaction form's type buttons: selectable only
 * for a new main category (income or expense — Money Transfer is the only
 * movement), read-only otherwise. The icon applies to main categories.
 */
export function CategoryForm({
  parentTitle,
  type: initialType,
  initialTitle,
  initialIcon,
  isMovement = false,
  transactionCount,
  canDelete = false,
  onDelete,
  onSubmit,
  onClose,
}: CategoryFormProps) {
  const theme = useTheme();
  const colors = useFormColors();
  const isSub = parentTitle !== undefined;
  const isEdit = initialTitle !== undefined;

  const [title, setTitle] = useState(initialTitle ?? '');
  const [type, setType] = useState<CategoryType>(initialType ?? 'expense');
  const [icon, setIcon] = useState(initialIcon ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  const SelectedIcon = icon ? lucideIconByName(icon) : undefined;

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ title: trimmed, type, icon });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const kinds = [
    { kind: 'expense' as const, symbol: 'minus.circle' as const, label: 'Expense' },
    { kind: 'income' as const, symbol: 'plus.circle' as const, label: 'Income' },
    { kind: 'transfer' as const, symbol: 'arrow.left.arrow.right' as const, label: 'Movement' },
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
          <View style={styles.typeRow}>
            {kinds.map(({ kind, symbol, label }) => {
              const palette = colors[kind];
              const selected = isMovement ? kind === 'transfer' : kind !== 'transfer' && kind === type;
              // Money Transfer is the only movement, and it has transfer logic a
              // new category would not get; a subcategory or an existing category
              // cannot change type.
              const locked = isEdit || isSub || kind === 'transfer';
              const color = 'fgOn' in palette && selected ? palette.fgOn : palette.fg;

              return (
                <Pressable
                  key={kind}
                  disabled={locked}
                  onPress={() => {
                    hapticSelect();
                    setType(kind as CategoryType);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: locked }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.typeButton,
                    {
                      backgroundColor: selected ? palette.bgOn : palette.bg,
                      borderColor: selected ? palette.borderOn : palette.border,
                      opacity: locked && !selected ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}>
                  <SymbolView name={symbol} size={20} tintColor={color} />
                </Pressable>
              );
            })}
          </View>

          {isSub ? (
            <ThemedText style={styles.parent} numberOfLines={1}>
              {parentTitle}
            </ThemedText>
          ) : null}

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isSub ? 'Subcategory title' : 'Title'}
            placeholderTextColor={theme.textSecondary}
            editable={!isSaving}
            accessibilityLabel="Title"
            style={[
              styles.input,
              { backgroundColor: colors.field, borderColor: colors.fieldBorder, color: colors.fieldText },
            ]}
          />

          {isEdit && transactionCount !== undefined ? (
            <ThemedText themeColor="textSecondary" style={styles.count}>
              {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}
            </ThemedText>
          ) : null}

          {isSub ? null : (
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={icon ? `Icon: ${icon}` : 'Icon'}
              style={({ pressed }) => [
                styles.fieldRow,
                {
                  backgroundColor: colors.field,
                  borderColor: colors.fieldBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              {/* A module-level Lucide component picked by name, not one created here. */}
              {/* eslint-disable-next-line react-hooks/static-components */}
              {SelectedIcon ? <SelectedIcon size={18} color={theme.textSecondary} strokeWidth={2} /> : null}
              <ThemedText
                numberOfLines={1}
                style={[styles.fieldText, { color: icon ? colors.fieldText : theme.textSecondary }]}>
                {icon || 'Icon'}
              </ThemedText>
              <SymbolView name="chevron.down" size={14} tintColor={colors.chevron} />
            </Pressable>
          )}

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
              <ActionButton label="Cancel" kind="cancel" onPress={() => setShowDeleteConfirm(false)} />
              <ActionButton
                label="Confirm"
                kind="danger"
                onPress={() => {
                  onDelete?.();
                  setShowDeleteConfirm(false);
                }}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <ActionButton label="Cancel" kind="cancel" disabled={isSaving} onPress={onClose} />
              <ActionButton
                label={isEdit ? 'Save' : 'Add'}
                kind="primary"
                busy={isSaving}
                onPress={handleSave}
              />
            </View>
          )}

          {isEdit && !showDeleteConfirm ? (
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              disabled={!canDelete}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canDelete }}
              accessibilityHint={
                canDelete
                  ? undefined
                  : isSub
                    ? 'Only subcategories with no transactions can be deleted'
                    : 'Only categories with no subcategories and no transactions can be deleted'
              }
              style={({ pressed }) => [
                styles.link,
                { opacity: !canDelete ? 0.4 : pressed ? 0.6 : 1 },
              ]}>
              <ThemedText style={[styles.linkText, { color: colors.link }]}>
                {isSub ? 'Delete Subcategory' : 'Delete Category'}
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>

      <IconPickerSheet
        visible={isPickerOpen}
        selected={icon}
        onSelect={setIcon}
        onClose={() => setPickerOpen(false)}
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
  typeRow: {
    flexDirection: 'row',
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
  parent: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  count: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  link: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
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
});
