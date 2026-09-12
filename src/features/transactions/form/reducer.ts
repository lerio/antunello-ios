/**
 * The transaction form's state machine.
 *
 * The web app drives this form with a handful of `useState` calls plus five
 * `useEffect`s that react to each other — a type change clears a mismatched
 * category, entering transfer mode overwrites the type and category, and so on.
 * That works, but the interactions between the effects are only discoverable by
 * reading all of them.
 *
 * Here the same rules are one explicit reducer. The effects' behaviour is
 * preserved by running a `normalize` pass after every action, which enforces
 * their invariants directly: the invariants are what the effects were for, and
 * stating them once is less error-prone than replicating the order in which
 * React happens to run them.
 *
 * ## The mode matrix
 *
 * Three entry modes (`add`, `edit`, `accept-pending`) and three kinds of entry
 * (`expense`, `income`, money transfer). Transfer is a *mode* rather than a peer
 * of expense and income — it forces the underlying type to `expense` — which is
 * why it is `isMoneyTransferMode` plus a type, and not a third type.
 */

import {
  formatAmountForCurrencyInput,
  normalizeAmountForCurrencyInput,
} from '@/domain/currency-amount-input';
import {
  emptyValidationErrors,
  hasValidationErrors,
  validateMoneyTransferFields,
  validateTransactionFields,
  type ValidationErrors,
} from '@/domain/form-validation';
import { generateTransferTitle } from '@/domain/money-transfer-validation';
import { getCategoryType, type TitleSuggestion } from '@/domain/types';

/** The category that represents a movement between the user's own funds. */
export const MONEY_TRANSFER_CATEGORY = 'Money Transfer';

/** The currencies a transaction may be denominated in, matching the web app. */
export const TRANSACTION_CURRENCIES = ['EUR', 'USD', 'JPY'] as const;
export type TransactionCurrency = (typeof TRANSACTION_CURRENCIES)[number];

export type FormMode = 'add' | 'edit' | 'accept-pending';

/** A fund, reduced to what the form needs. */
export type FundRef = { id: string; name: string };

export type FormState = {
  mode: FormMode;
  type: 'expense' | 'income';
  isMoneyTransferMode: boolean;

  /** Raw as-typed text, normalised for the selected currency. */
  amount: string;
  currency: TransactionCurrency;
  title: string;
  mainCategory: string;
  subCategory: string;
  /** Full timestamp; the form edits date and time together. */
  date: Date;

  hideFromTotals: boolean;
  splitAcrossYear: boolean;

  sourceFund: FundRef | null;
  targetFund: FundRef | null;

  /**
   * Which fields a title suggestion populated, so the UI can mark them.
   * Cleared per-field as soon as the user edits that field by hand.
   */
  autoFilled: { type: boolean; mainCategory: boolean; subCategory: boolean };

  errors: ValidationErrors;
  /** True once validate has run, so errors are not shown before first submit. */
  hasAttemptedSubmit: boolean;
};

export type FormAction =
  | { kind: 'setType'; value: 'expense' | 'income' }
  | { kind: 'setTransferMode'; value: boolean }
  | { kind: 'setAmount'; value: string }
  | { kind: 'blurAmount' }
  | { kind: 'setCurrency'; value: TransactionCurrency }
  | { kind: 'setTitle'; value: string }
  | { kind: 'setMainCategory'; value: string }
  | { kind: 'setSubCategory'; value: string }
  | { kind: 'setDate'; value: Date }
  | { kind: 'setHideFromTotals'; value: boolean }
  | { kind: 'setSplitAcrossYear'; value: boolean }
  | { kind: 'setFund'; which: 'source' | 'target'; value: FundRef | null }
  | { kind: 'applySuggestion'; value: TitleSuggestion }
  | { kind: 'validate' }
  | { kind: 'reset'; state: FormState };

/** A blank form for the given mode. */
export function initialFormState(mode: FormMode = 'add'): FormState {
  return {
    mode,
    type: 'expense',
    isMoneyTransferMode: false,
    amount: '',
    currency: 'EUR',
    title: '',
    mainCategory: '',
    subCategory: '',
    date: new Date(),
    hideFromTotals: false,
    splitAcrossYear: false,
    sourceFund: null,
    targetFund: null,
    autoFilled: { type: false, mainCategory: false, subCategory: false },
    errors: { ...emptyValidationErrors },
    hasAttemptedSubmit: false,
  };
}

/**
 * Enforces the invariants the web app's effects maintain.
 *
 * Transfer mode wins over everything: it pins the type to `expense` and the
 * category to Money Transfer. Only once that has been applied is the
 * type/category match checked, so the transfer category is never cleared for
 * "not matching" a type it just forced.
 *
 * @param state The state after an action.
 * @returns State with the invariants held.
 */
function normalize(state: FormState): FormState {
  let next = state;

  if (next.isMoneyTransferMode) {
    next = {
      ...next,
      type: 'expense',
      mainCategory: MONEY_TRANSFER_CATEGORY,
      subCategory: MONEY_TRANSFER_CATEGORY,
    };
  } else if (next.mainCategory === MONEY_TRANSFER_CATEGORY) {
    // Leaving transfer mode drops the category it had forced.
    next = { ...next, mainCategory: '', subCategory: '' };
  }

  // A category must belong to the current type — switching from expense to
  // income while a category is selected clears it rather than leaving an
  // income transaction filed under an expense category.
  if (next.mainCategory && getCategoryType(next.mainCategory) !== next.type) {
    next = { ...next, mainCategory: '', subCategory: '' };
  }

  // Keep the title in step with the chosen funds while in transfer mode.
  if (next.isMoneyTransferMode && next.sourceFund && next.targetFund) {
    next = { ...next, title: generateTransferTitle(next.sourceFund.name, next.targetFund.name) };
  }

  return next;
}

/**
 * Applies an action to the form state.
 *
 * @param state Current state.
 * @param action The action to apply.
 * @returns The next state, with invariants enforced.
 */
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.kind) {
    case 'reset':
      return action.state;

    case 'setType':
      // Choosing a type explicitly leaves transfer mode, matching the web app's
      // type buttons.
      return normalize({
        ...state,
        isMoneyTransferMode: false,
        type: action.value,
        autoFilled: { ...state.autoFilled, type: false },
        errors: clearError(state.errors, 'mainCategory', 'subCategory'),
      });

    case 'setTransferMode':
      return normalize({
        ...state,
        isMoneyTransferMode: action.value,
        errors: clearError(state.errors, 'mainCategory', 'subCategory'),
      });

    case 'setAmount':
      return {
        ...state,
        amount: normalizeAmountForCurrencyInput(action.value, state.currency),
        errors: clearError(state.errors, 'amount'),
      };

    case 'blurAmount':
      if (!state.amount) return state;
      return { ...state, amount: formatAmountForCurrencyInput(state.amount, state.currency) };

    case 'setCurrency':
      // Re-format for the new currency's precision — JPY has no minor unit, so
      // a typed "1.50" must collapse to "1" rather than be silently rounded at
      // display time.
      return {
        ...state,
        currency: action.value,
        amount: state.amount
          ? formatAmountForCurrencyInput(state.amount, action.value)
          : state.amount,
      };

    case 'setTitle':
      return {
        ...state,
        title: action.value,
        errors: clearError(state.errors, 'title'),
      };

    case 'setMainCategory':
      return normalize({
        ...state,
        mainCategory: action.value,
        // Changing the main category invalidates any subcategory chosen under
        // the previous one.
        subCategory: '',
        autoFilled: { ...state.autoFilled, mainCategory: false, subCategory: false },
        errors: clearError(state.errors, 'mainCategory', 'subCategory'),
      });

    case 'setSubCategory':
      return {
        ...state,
        subCategory: action.value,
        autoFilled: { ...state.autoFilled, subCategory: false },
        errors: clearError(state.errors, 'subCategory'),
      };

    case 'setDate':
      return { ...state, date: action.value };

    case 'setHideFromTotals':
      return { ...state, hideFromTotals: action.value };

    case 'setSplitAcrossYear':
      return { ...state, splitAcrossYear: action.value };

    case 'setFund':
      return normalize({
        ...state,
        ...(action.which === 'source'
          ? { sourceFund: action.value }
          : { targetFund: action.value }),
        errors: clearError(state.errors, 'mainCategory', 'subCategory'),
      });

    case 'applySuggestion':
      return normalize({
        ...state,
        // The suggestion's own title replaces what was typed — partial text like
        // "Tesc" becomes "Tesco". The web app does this in its
        // `TitleSuggestionInput` rather than in the form's suggestion handler,
        // which is why it is easy to miss when reading the form alone.
        title: action.value.title,
        type: action.value.type,
        mainCategory: action.value.main_category,
        subCategory: action.value.sub_category ?? '',
        autoFilled: { type: true, mainCategory: true, subCategory: true },
        errors: { ...emptyValidationErrors },
      });

    case 'validate':
      return { ...state, hasAttemptedSubmit: true, errors: validate(state) };

    default:
      return state;
  }
}

/**
 * Validates the form, using the transfer rules when in transfer mode.
 *
 * In transfer mode the transfer validator's fund errors are written into the
 * `mainCategory` and `subCategory` slots. That is not a naming accident: the
 * web app shows the source and target fund pickers in the same two grid cells
 * the category pickers occupy, and reusing the slots keeps the error messages
 * anchored to the fields the user can see.
 *
 * @param state The state to validate.
 * @returns Errors keyed by field.
 */
export function validate(state: FormState): ValidationErrors {
  if (state.isMoneyTransferMode) {
    return validateMoneyTransferFields(
      state.amount,
      state.sourceFund?.id ?? null,
      state.targetFund?.id ?? null,
    );
  }

  return validateTransactionFields(
    state.amount,
    state.mainCategory,
    state.subCategory,
    state.title,
  );
}

/** Blank out specific error fields, leaving the rest untouched. */
function clearError(errors: ValidationErrors, ...fields: (keyof ValidationErrors)[]) {
  const cleared = { ...errors };
  for (const field of fields) cleared[field] = '';
  return cleared;
}

/** Whether the form currently has anything blocking submission. */
export function isSubmittable(state: FormState): boolean {
  return !hasValidationErrors(validate(state));
}
