/**
 * The per-account settings on an `integration_configs` row.
 *
 * Ported from `/api/enable-banking/update-mapping`, which is a read-modify-write
 * of this JSON object. The web app does it on the server because that is where
 * its settings page lives; the table has an owner-update policy, so here it is a
 * direct write and needs no route at all.
 *
 * The merge is the part worth reproducing carefully: **a key that is absent from
 * the patch is left alone, while a key present and empty is cleared.** The
 * settings page sends one field at a time — changing a fund mapping must not
 * disturb the bulk-fetch toggle — but it also has to be able to unset a mapping,
 * which it does by sending an empty value. Treating an empty value as "no
 * change" would make a mapping impossible to remove.
 */

import type { IntegrationSettings } from '@/features/settings/integration-status';

/** The fields the settings screen can change. */
export type IntegrationSettingsPatch = {
  fund_category_id?: string | null;
  wealth_fund_category_id?: string | null;
  bulk_fetch_enabled?: boolean;
};

/**
 * Applies a partial update to an account's settings.
 *
 * @param current The stored settings.
 * @param patch The fields to change; absent keys are left untouched.
 * @returns The merged settings.
 */
export function mergeIntegrationSettings(
  current: IntegrationSettings | null,
  patch: IntegrationSettingsPatch,
): IntegrationSettings {
  const merged: IntegrationSettings = { ...(current ?? {}) };

  if (patch.fund_category_id !== undefined) {
    // `|| null` rather than the value itself, matching upstream: an empty string
    // from a picker means "none", and storing "" would read as a fund id that
    // exists nowhere.
    merged.fund_category_id = patch.fund_category_id || null;
  }

  if (patch.wealth_fund_category_id !== undefined) {
    merged.wealth_fund_category_id = patch.wealth_fund_category_id || null;
  }

  if (patch.bulk_fetch_enabled !== undefined) {
    merged.bulk_fetch_enabled = patch.bulk_fetch_enabled;
  }

  return merged;
}
