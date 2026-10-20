/**
 * @vendored-from antunello-app:utils/form-validation.ts
 * @upstream-sha256 ac8653bd456d2e5739f0f5fed496f8757186ef90e70b960601c7f9637200ea00
 * @vendored-on 2026-10-19
 * @parity exact
 * @divergences none
 *
 * DO NOT EDIT THIS COPY IN ISOLATION.
 *
 * This file is vendored verbatim from the web app. The hash above is of the
 * upstream file after alias rewriting; it must equal the hash of everything
 * below this header. If you change the web implementation, re-run
 * `npm run vendor` and follow PARITY.md.
 */
/**
 * Form validation utilities for transaction forms.
 *
 * Provides validation logic for regular transaction and money transfer fields,
 * including amount, category selection, title, and fund references. Returns
 * structured error objects that can be displayed inline in the UI.
 *
 * @module utils/form-validation
 */

import { isValidPositiveNumber } from "./number";

/**
 * Structured validation errors for a transaction form.
 * Each field has a corresponding error message string, empty string means no error.
 */
export interface ValidationErrors {
  /** Error message for the amount field */
  amount: string;
  /** Error message for the main category field (or source fund in transfers) */
  mainCategory: string;
  /** Error message for the sub category field (or target fund in transfers) */
  subCategory: string;
  /** Error message for the title field */
  title: string;
}

/**
 * Initial empty validation state with no errors.
 * All fields set to empty string, indicating valid state.
 */
export const emptyValidationErrors: ValidationErrors = {
  amount: "",
  mainCategory: "",
  subCategory: "",
  title: "",
};

/**
 * Validate regular transaction form fields.
 * Checks that amount is a valid positive number, main and sub categories
 * are selected, and a title is provided.
 *
 * @param amount - The amount string from the form input
 * @param mainCategory - The selected main category
 * @param subCategory - The selected sub category
 * @param title - The transaction title
 * @returns A ValidationErrors object with error messages for each invalid field
 */
export function validateTransactionFields(
  amount: string,
  mainCategory: string,
  subCategory: string,
  title: string
): ValidationErrors {
  const errors = { ...emptyValidationErrors };

  if (!isValidPositiveNumber(amount)) {
    errors.amount = "Please enter a valid amount";
  }

  if (!mainCategory) {
    errors.mainCategory = "Please select a main category";
  }

  if (!subCategory?.trim()) {
    errors.subCategory = "Please select a sub category";
  }

  if (!title?.trim()) {
    errors.title = "Please enter a title";
  }

  return errors;
}

/**
 * Validate money transfer form fields.
 * Checks that the amount is valid, both source and target funds are selected,
 * and they are not the same fund.
 *
 * @param amount - The transfer amount string from the form input
 * @param sourceFundId - The selected source fund category ID, or null if none
 * @param targetFundId - The selected target fund category ID, or null if none
 * @returns A ValidationErrors object with error messages for each invalid field
 */
export function validateMoneyTransferFields(
  amount: string,
  sourceFundId: string | null,
  targetFundId: string | null
): ValidationErrors {
  const errors = { ...emptyValidationErrors };

  if (!isValidPositiveNumber(amount)) {
    errors.amount = "Please enter a valid amount";
  }

  if (!sourceFundId) {
    errors.mainCategory = "Please select a source fund";
  }

  if (!targetFundId) {
    errors.subCategory = "Please select a target fund";
  }

  if (sourceFundId && targetFundId && sourceFundId === targetFundId) {
    errors.subCategory = "Source and target funds must be different";
  }

  return errors;
}

/**
 * Check if there are any validation errors in the error object.
 *
 * @param errors - The ValidationErrors object to check
 * @returns True if any field has a non-empty error message
 */
export function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((error) => error !== "");
}
