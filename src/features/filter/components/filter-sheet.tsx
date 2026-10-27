import { SymbolView } from 'expo-symbols';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PickerList, type PickerListProps, type PickerOption } from '@/components/picker-list';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { CURRENCY_OPTIONS } from '@/domain/app-constants';
import {
  filterReducer,
  hasAnyFilter,
  labelOfSubCategory,
  selectableCategories,
  selectableSubCategories,
  type FilterAction,
  type FilterCriteria,
  type FilterType,
} from '@/features/filter/filter-criteria';
import { ChipRow } from '@/features/filter/components/chip-row';
import { useCurrencies } from '@/features/filter/use-currencies';
import { useFunds } from '@/features/funds/use-funds';
import { useAvailableYears } from '@/features/year/use-available-years';
import { useTheme } from '@/hooks/use-theme';

const TYPE_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'movement', label: 'Movement' },
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type OpenPicker = 'year' | 'month' | 'category' | 'subcategory' | 'fund' | null;

/** Heading shown while a picker is open. */
const PICKER_TITLES: Record<NonNullable<OpenPicker>, string> = {
  year: 'Year',
  month: 'Month',
  category: 'Category',
  subcategory: 'Subcategory',
  fund: 'Fund',
};

type FilterSheetProps = {
  visible: boolean;
  criteria: FilterCriteria;
  /** Called for every change, so the results update as controls are touched. */
  onChange: (criteria: FilterCriteria) => void;
  /** Done, or the handle pulled down: keep the filters and dismiss. */
  onClose: () => void;
};

/** How far, or how fast, a pull must go to dismiss rather than spring back. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * The filter controls.
 *
 * A full-height sheet pulled up to the top, with no dimmed backdrop. Changes
 * apply as they are made, so Done and pulling the handle down are the same
 * thing: the sheet goes away and the filters stay.
 *
 * The long lists (categories, subcategories, funds) are tapped through to a
 * picker, since twenty chips with their subcategories would bury the controls
 * that matter. The short ones (type, currency) are inline.
 */
export function FilterSheet({ visible, criteria, onChange, onClose }: FilterSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const { data: currencies } = useCurrencies();
  const { data: funds } = useFunds();
  const years = useAvailableYears();

  // No local copy of the criteria: every control dispatches through the reducer
  // and the result goes straight back to the parent, which owns the state. A
  // draft kept here would be a second source of truth for the same object, and
  // would need an effect to re-seed it every time the sheet reopened.
  function dispatch(action: FilterAction) {
    onChange(filterReducer(criteria, action));
  }

  const categoryOptions: PickerOption[] = useMemo(
    () => selectableCategories(criteria.types).map((category) => ({
      value: category.category,
      label: category.category,
      detail: category.type === 'income' ? 'Income' : 'Expense',
    })),
    [criteria.types],
  );

  const subCategoryOptions: PickerOption[] = useMemo(
    () =>
      selectableSubCategories(criteria).map((option) => ({
        value: option.value,
        label: option.label,
        group: option.group,
      })),
    [criteria],
  );

  const fundOptions: PickerOption[] = useMemo(
    () => (funds ?? []).map((fund) => ({
      value: fund.id,
      label: fund.name,
      detail: fund.currency,
      group: fund.top_level_category,
    })),
    [funds],
  );

  const selectedCurrency =
    criteria.currencies.length === 1 ? criteria.currencies[0] : null;

  const yearOptions: PickerOption[] = useMemo(
    () => [
      { value: 'all', label: 'All time' },
      // Newest first: the year being looked for is almost always the recent one.
      ...[...years].reverse().map((year) => ({
        value: String(year.year),
        label: String(year.year),
      })),
    ],
    [years],
  );

  const monthOptions: PickerOption[] = useMemo(
    () => [
      { value: 'all', label: 'Whole year' },
      ...MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name })),
    ],
    [],
  );

  // One entry per picker, so the body renders a single `PickerList` rather than
  // five blocks that would each have to be kept in step with its field.
  const pickerProps: Record<NonNullable<OpenPicker>, PickerListProps> = {
    category: {
      options: categoryOptions,
      selected: criteria.mainCategories,
      onToggle: (value) => dispatch({ type: 'toggleMainCategory', value }),
    },
    subcategory: {
      options: subCategoryOptions,
      selected: criteria.subCategories,
      onToggle: (value) => dispatch({ type: 'toggleSubCategory', value }),
    },
    fund: {
      options: fundOptions,
      selected: criteria.fundSourceIds,
      onToggle: (value) => dispatch({ type: 'toggleFund', value }),
    },
    year: {
      options: yearOptions,
      selected: criteria.year === null ? 'all' : String(criteria.year),
      // A single choice is the answer, so the sheet returns to the controls
      // rather than staying on the list.
      onSelect: (value) => {
        dispatch({ type: 'setYear', year: value === 'all' ? null : Number(value) });
        setOpenPicker(null);
      },
    },
    month: {
      options: monthOptions,
      selected: criteria.month === null ? 'all' : String(criteria.month),
      onSelect: (value) => {
        dispatch({ type: 'setMonth', month: value === 'all' ? null : Number(value) });
        setOpenPicker(null);
      },
    },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <PullDownSheet
        top={insets.top}
        bottomInset={insets.bottom}
        backgroundColor={theme.background}
        handleColor={theme.textSecondary}
        onClose={onClose}
        header={
          <>
        <View style={[styles.header, { borderBottomColor: theme.separator }]}>
          {openPicker ? (
            // A drill-down inside the sheet rather than a second modal on top of
            // it: nesting React Native modals is a presentation case this app has
            // never exercised, and a sheet that swaps its own content is what iOS
            // settings screens do anyway.
            <Pressable
              onPress={() => setOpenPicker(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to filters">
              <ThemedText style={[styles.headerButton, { color: theme.tint }]}>Back</ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => dispatch({ type: 'reset' })}
              disabled={!hasAnyFilter(criteria)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters">
              <ThemedText
                style={[
                  styles.headerButton,
                  { color: hasAnyFilter(criteria) ? theme.tint : theme.textSecondary },
                ]}>
                Clear
              </ThemedText>
            </Pressable>
          )}

          <ThemedText style={styles.headerTitle}>
            {openPicker ? PICKER_TITLES[openPicker] : 'Filter'}
          </ThemedText>

          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <ThemedText style={[styles.headerButton, { color: theme.tint }]}>Done</ThemedText>
          </Pressable>
        </View>
          </>
        }>

        {openPicker ? (
          <PickerList
            {...pickerProps[openPicker]}
            // Remounts on each open, so the search box starts empty.
            key={openPicker}
            searchable={PICKER_TITLES[openPicker] !== 'Year' && PICKER_TITLES[openPicker] !== 'Month'}
          />
        ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inlineRow}>
            <ThemedText themeColor="textSecondary" style={styles.inlineLabel}>
              Period
            </ThemedText>
            <View style={styles.inlinePeriodRow}>
              <FieldButton
                label={criteria.year === null ? 'All time' : String(criteria.year)}
                onPress={() => setOpenPicker('year')}
                style={styles.inlineField}
              />
              <FieldButton
                label={criteria.month === null ? 'Whole year' : MONTH_NAMES[criteria.month - 1]}
                onPress={() => setOpenPicker('month')}
                disabled={criteria.year === null}
                style={styles.inlineField}
              />
            </View>
          </View>

          {(currencies ?? []).length > 0 ? (
            <View style={styles.inlineRow}>
              <ThemedText themeColor="textSecondary" style={styles.inlineLabel}>
                Currency
              </ThemedText>
              <ChipRow
                options={(currencies ?? []).map((code) => ({ value: code, label: code }))}
                selected={criteria.currencies}
                onToggle={(value) => dispatch({ type: 'toggleCurrency', value })}
                accessibilityLabel="Currency"
                style={styles.inlineChips}
              />
            </View>
          ) : null}

          <View style={styles.inlineRow}>
            <ThemedText themeColor="textSecondary" style={styles.inlineLabel}>
              Type
            </ThemedText>
            <ChipRow
              options={TYPE_OPTIONS}
              selected={criteria.types}
              onToggle={(value) => dispatch({ type: 'toggleType', value: value as FilterType })}
              accessibilityLabel="Type"
              style={styles.inlineChips}
            />
          </View>

          <Section
            label="Category"
            summary={
              criteria.mainCategories.length > 0 ? `${criteria.mainCategories.length} selected` : undefined
            }>
            <FieldButton
              label={
                criteria.mainCategories.length === 0
                  ? 'Any category'
                  : criteria.mainCategories.join(', ')
              }
              onPress={() => setOpenPicker('category')}
            />
          </Section>

          {criteria.mainCategories.length > 0 && subCategoryOptions.length > 0 ? (
            <Section
              label="Subcategory"
              summary={
                criteria.subCategories.length > 0
                  ? criteria.subCategories.map(labelOfSubCategory).join(', ')
                  : undefined
              }>
              <FieldButton
                label={
                  criteria.subCategories.length === 0
                    ? 'Any subcategory'
                    : `${criteria.subCategories.length} selected`
                }
                onPress={() => setOpenPicker('subcategory')}
              />
            </Section>
          ) : null}

          {fundOptions.length > 0 ? (
            <Section
              label="Fund"
              summary={
                criteria.fundSourceIds.length > 0
                  ? `${criteria.fundSourceIds.length} selected`
                  : undefined
              }>
              <FieldButton
                label={
                  criteria.fundSourceIds.length === 0
                    ? 'Any fund'
                    : `${criteria.fundSourceIds.length} selected`
                }
                onPress={() => setOpenPicker('fund')}
              />
            </Section>
          ) : null}

          {selectedCurrency ? (
            <Section label="Amount range">
              <View style={styles.periodRow}>
                <AmountField
                  value={criteria.amountMin}
                  placeholder="Min"
                  currency={selectedCurrency}
                  onChange={(value) =>
                    dispatch({ type: 'setAmountRange', min: value, max: criteria.amountMax })
                  }
                />
                <AmountField
                  value={criteria.amountMax}
                  placeholder="Max"
                  currency={selectedCurrency}
                  onChange={(value) =>
                    dispatch({ type: 'setAmountRange', min: criteria.amountMin, max: value })
                  }
                />
              </View>
            </Section>
          ) : null}
        </ScrollView>
        )}
      </PullDownSheet>
    </Modal>
  );
}

type PullDownSheetProps = {
  top: number;
  bottomInset: number;
  backgroundColor: string;
  handleColor: string;
  /** Dismiss: Done and a completed pull both end up here. */
  onClose: () => void;
  /** The title row; it is part of the drag area along with the handle. */
  header: ReactNode;
  children: ReactNode;
};

/**
 * A sheet pulled up to the top, with a handle that drags it back down.
 *
 * The drag is a native-thread pan from gesture-handler rather than the JS
 * `PanResponder` it replaced: the sheet lives in a Modal, which is its own
 * native root, and the JS responder never saw the drag there. For the same
 * reason it carries its own `GestureHandlerRootView`.
 *
 * This is a component of its own so that its animated position is created fresh
 * each time the Modal opens — a Modal renders nothing while hidden — which means
 * a previous pull can never leave the next opening off-screen.
 */
function PullDownSheet({
  top,
  bottomInset,
  backgroundColor,
  handleColor,
  onClose,
  header,
  children,
}: PullDownSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);

  // Only a clear downward pull activates the gesture, so taps on Clear and Done
  // in the header still go through.
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(windowHeight, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Animated.View
        style={[styles.sheet, { backgroundColor, top, paddingBottom: bottomInset }, motion]}>
        <GestureDetector gesture={pan}>
          <View collapsable={false}>
            <View style={styles.handleArea} accessibilityLabel="Pull down to close">
              <View style={[styles.handle, { backgroundColor: handleColor }]} />
            </View>
            {header}
          </View>
        </GestureDetector>

        {children}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

/** A labelled group of controls. */
function Section({
  label,
  summary,
  children,
}: {
  label: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {label}
        </ThemedText>
        {summary ? (
          <ThemedText themeColor="textSecondary" style={styles.sectionSummary} numberOfLines={1}>
            {summary}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A tappable field that opens a picker. */
function FieldButton({
  label,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.field,
        style,
        {
          backgroundColor: theme.card,
          borderColor: theme.separator,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}>
      <ThemedText style={styles.fieldLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <SymbolView name="chevron.up.chevron.down" size={11} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

/**
 * A numeric bound for the amount range.
 *
 * Two fields rather than the web app's dual-thumb slider. The slider is capped
 * at 10,000 in steps of 100 — so on the web the filter simply cannot express
 * "over 12,000" or "under 5". Fields are exact, are quicker than dragging on a
 * phone, and accept every value the slider does.
 */
function AmountField({
  value,
  placeholder,
  currency,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  currency: string;
  onChange: (value: number | null) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value === null ? '' : String(value));
  const [lastValue, setLastValue] = useState(value);
  const symbol =
    CURRENCY_OPTIONS.find((option) => option.value === currency)?.symbol ?? `${currency} `;

  // Adopting an outside change — the Clear button — without fighting the user
  // mid-keystroke. Two things make that delicate: re-seeding from the parsed
  // value would eat the decimal point in "5.", and a partial entry like "." has
  // no value at all. So the text is only replaced when it disagrees with the new
  // value, and only a *finite* parse is reported upward.
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = text.trim() === '' ? null : Number(text);
    const agrees = parsed === value || (parsed === null && value === null);
    if (!agrees) setText(value === null ? '' : String(value));
  }

  function handleChange(next: string) {
    // Digits and a separator only. A minus sign is not a bound the web app can
    // express either, and would silently match nothing.
    const cleaned = next.replace(/[^0-9.]/g, '');
    setText(cleaned);

    if (cleaned.trim() === '') {
      onChange(null);
      return;
    }

    const parsed = Number(cleaned);
    // "." and "1.2.3" are mid-typing, not numbers yet; leaving the criteria
    // alone keeps the last usable bound while the user finishes.
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  return (
    <View style={[styles.amountField, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <ThemedText themeColor="textSecondary" style={styles.currencyPrefix}>
        {symbol}
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={[styles.amountInput, { color: theme.text }]}
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerButton: {
    fontSize: 17,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionSummary: {
    fontSize: 12,
    flexShrink: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 0,
  },
  inlineField: {
    flex: 1,
  },
  inlinePeriodRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  inlineChips: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 16,
  },
  amountField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  currencyPrefix: {
    fontSize: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
});
