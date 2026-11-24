import { useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Card, CardIconButton } from '@/components/card';
import { OutlineButton } from '@/components/outline-button';
import { PickerSheet } from '@/components/picker-sheet';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/domain/app-constants';
import { TOP_LEVEL_FUND_CATEGORIES, type FundCategory } from '@/domain/types';
import { FieldRow } from '@/features/settings/components/account-controls';
import {
  useAllFunds,
  useFundCategoryMutations,
  type FundDraft,
} from '@/features/settings/use-fund-categories';
import { useTheme } from '@/hooks/use-theme';
import { messageOf } from '@/lib/errors';

const EMPTY_DRAFT: FundDraft = {
  name: '',
  description: '',
  currency: 'EUR',
  amount: 0,
  is_active: true,
  top_level_category: '',
};

const draftOf = (fund: FundCategory): FundDraft => ({
  name: fund.name,
  description: fund.description ?? '',
  currency: fund.currency,
  amount: fund.amount,
  is_active: fund.is_active,
  top_level_category: fund.top_level_category ?? '',
});

const categoryOptions = [
  { value: '', label: 'No Category' },
  ...TOP_LEVEL_FUND_CATEGORIES.map((c) => ({ value: c, label: c })),
];
const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

/**
 * Settings → Funds: add, edit and delete fund categories.
 *
 * Same fields and behaviour as the web manager, restyled to match the rest of
 * Settings: one card per fund, icon buttons in its title row.
 */
export function FundsManager() {
  const { data: funds, isLoading } = useAllFunds();
  const { addFund, updateFund, deleteFund } = useFundCategoryMutations();

  const [isAdding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FundDraft>(EMPTY_DRAFT);

  const fundList = funds ?? [];

  function startAdd() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setAdding(true);
  }

  function startEdit(fund: FundCategory) {
    setAdding(false);
    setDraft(draftOf(fund));
    setEditingId(fund.id);
  }

  function save() {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Give the fund a name.');
      return;
    }
    const clean = { ...draft, name: draft.name.trim() };
    const onError = (error: unknown) => Alert.alert('Could not save', messageOf(error));

    if (editingId) {
      updateFund.mutate({ id: editingId, draft: clean }, { onSuccess: () => setEditingId(null), onError });
    } else {
      addFund.mutate({ draft: clean, orderIndex: fundList.length }, { onSuccess: () => setAdding(false), onError });
    }
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function confirmDelete(fund: FundCategory) {
    Alert.alert('Delete fund category?', `Are you sure you want to delete ${fund.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteFund.mutate(fund.id, {
            onError: (error) => Alert.alert('Could not delete', messageOf(error)),
          }),
      },
    ]);
  }

  const isSaving = addFund.isPending || updateFund.isPending;

  return (
    <>
      {isAdding ? (
        <Card style={styles.form}>
          <View style={styles.head}>
            <ThemedText style={styles.name}>New fund category</ThemedText>
            <View style={styles.actions}>
              <CardIconButton symbol="checkmark" label="Save" onPress={save} loading={isSaving} />
              <CardIconButton symbol="xmark" label="Cancel" onPress={cancel} />
            </View>
          </View>
          <FundForm draft={draft} onChange={setDraft} />
        </Card>
      ) : null}

      {isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={Layout.cardRadius} />)
      ) : fundList.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No fund categories configured yet.
          </ThemedText>
        </Card>
      ) : (
        fundList.map((fund) =>
          editingId === fund.id ? (
            <Card key={fund.id} style={styles.form}>
              <View style={styles.head}>
                <ThemedText style={styles.name} numberOfLines={1}>
                  {fund.name}
                </ThemedText>
                <View style={styles.actions}>
                  <CardIconButton symbol="checkmark" label="Save" onPress={save} loading={isSaving} />
                  <CardIconButton symbol="xmark" label="Cancel" onPress={cancel} />
                </View>
              </View>
              <FundForm draft={draft} onChange={setDraft} />
            </Card>
          ) : (
            <FundCard
              key={fund.id}
              fund={fund}
              onEdit={() => startEdit(fund)}
              onDelete={() => confirmDelete(fund)}
            />
          ),
        )
      )}

      {!isAdding ? <OutlineButton label="Add New Fund Category" onPress={startAdd} /> : null}
    </>
  );
}

function FundCard({
  fund,
  onEdit,
  onDelete,
}: {
  fund: FundCategory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.title}>
          <ThemedText style={styles.name}>{fund.name}</ThemedText>
          {!fund.is_active ? <Pill label="Inactive" /> : null}
        </View>
        <View style={styles.actions}>
          <CardIconButton symbol="pencil" label={`Edit ${fund.name}`} onPress={onEdit} />
          <CardIconButton symbol="trash" label={`Delete ${fund.name}`} onPress={onDelete} />
        </View>
      </View>

      {fund.description ? (
        <ThemedText themeColor="textSecondary" style={styles.detail}>
          {fund.description}
        </ThemedText>
      ) : null}

      <View style={styles.meta}>
        <ThemedText style={[styles.detail, { color: theme.text }]}>
          {fund.amount.toFixed(2)} {fund.currency}
        </ThemedText>
        {fund.top_level_category ? <Pill label={fund.top_level_category} /> : null}
      </View>
    </Card>
  );
}

function Pill({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText themeColor="textSecondary" style={styles.pillLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** The fund fields, shared by add and edit. */
function FundForm({ draft, onChange }: { draft: FundDraft; onChange: (next: FundDraft) => void }) {
  const [picker, setPicker] = useState<'category' | 'currency' | null>(null);
  const set = (changes: Partial<FundDraft>) => onChange({ ...draft, ...changes });

  return (
    <View style={styles.fields}>
      <TextField label="Name" value={draft.name} onChangeText={(name) => set({ name })} placeholder="e.g., Bank Account, Investment" />
      <FieldRow
        label="Top Level Category"
        value={draft.top_level_category || 'No Category'}
        onPress={() => setPicker('category')}
      />
      <FieldRow label="Currency" value={draft.currency} onPress={() => setPicker('currency')} />
      <TextField
        label="Amount"
        value={String(draft.amount)}
        onChangeText={(text) => set({ amount: Number.parseFloat(text) || 0 })}
        placeholder="0.00"
        keyboardType="numbers-and-punctuation"
      />
      <TextField
        label="Description"
        value={draft.description}
        onChangeText={(description) => set({ description })}
        placeholder="Optional description"
      />
      <View style={styles.switchRow}>
        <ThemedText style={styles.detail}>Active</ThemedText>
        <Switch value={draft.is_active} onValueChange={(is_active) => set({ is_active })} />
      </View>

      <PickerSheet
        visible={picker === 'category'}
        title="Top Level Category"
        options={categoryOptions}
        selected={draft.top_level_category}
        onSelect={(top_level_category) => set({ top_level_category })}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'currency'}
        title="Currency"
        options={currencyOptions}
        selected={draft.currency}
        onSelect={(currency) => set({ currency })}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

/** A labelled text input, matching the select fields' label and border. */
function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'numbers-and-punctuation';
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        style={[styles.input, { color: theme.text, borderColor: theme.separator }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Layout.stackGap,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.iconButton,
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: 999,
  },
  pillLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  fields: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  input: {
    height: 40,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    borderRadius: Radius.small + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
