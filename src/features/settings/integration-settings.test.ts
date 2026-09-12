/**
 * Tests for the integration settings merge.
 *
 * The absent-versus-empty distinction is the whole point. A patch naming one
 * field must leave the others alone — changing a fund mapping cannot disturb the
 * bulk-fetch toggle — while an empty value must still clear a mapping, or a
 * mapping could never be removed.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeIntegrationSettings } from '@/features/settings/integration-settings';
import type { IntegrationSettings } from '@/features/settings/integration-status';

const stored: IntegrationSettings = {
  bank_name: 'Revolut Bank',
  iban: 'IT60X0542811101000000123456',
  fund_category_id: 'fund-cash',
  bulk_fetch_enabled: true,
};

describe('merging a partial update', () => {
  it('changes only the field named', () => {
    const merged = mergeIntegrationSettings(stored, { fund_category_id: 'fund-new' });

    assert.equal(merged.fund_category_id, 'fund-new');
    assert.equal(merged.bulk_fetch_enabled, true, 'untouched');
    assert.equal(merged.bank_name, 'Revolut Bank', 'untouched');
    assert.equal(merged.iban, stored.iban, 'untouched');
  });

  it('changes the bulk-fetch toggle without disturbing a mapping', () => {
    const merged = mergeIntegrationSettings(stored, { bulk_fetch_enabled: false });

    assert.equal(merged.bulk_fetch_enabled, false);
    assert.equal(merged.fund_category_id, 'fund-cash');
  });

  it('clears a mapping given a null', () => {
    const merged = mergeIntegrationSettings(stored, { fund_category_id: null });

    assert.equal(merged.fund_category_id, null);
  });

  it('clears a mapping given an empty string', () => {
    // A picker that offers "none" reports it as an empty value rather than a
    // null, and storing "" would be a fund id that exists nowhere.
    const merged = mergeIntegrationSettings(stored, { fund_category_id: '' });

    assert.equal(merged.fund_category_id, null);
  });

  it('leaves a field alone when the patch does not mention it', () => {
    const merged = mergeIntegrationSettings(stored, {});

    assert.deepEqual(merged, stored);
  });

  it('does not mutate the stored object', () => {
    const original = { ...stored };
    mergeIntegrationSettings(stored, { fund_category_id: 'other' });

    assert.deepEqual(stored, original);
  });

  it('works from empty settings', () => {
    const merged = mergeIntegrationSettings(null, { fund_category_id: 'fund-1' });

    assert.equal(merged.fund_category_id, 'fund-1');
    assert.equal(merged.wealth_fund_category_id, undefined, 'not invented');
  });

  it('keeps a Trade Republic wealth mapping independent of the cash mapping', () => {
    // Both are set on the same row, and the saveback path needs the wealth one
    // while the round-up path needs both.
    const tr = mergeIntegrationSettings(stored, {
      fund_category_id: 'tr-cash',
      wealth_fund_category_id: 'tr-wealth',
    });

    assert.equal(tr.fund_category_id, 'tr-cash');
    assert.equal(tr.wealth_fund_category_id, 'tr-wealth');

    const cashOnly = mergeIntegrationSettings(tr, { fund_category_id: 'other' });

    assert.equal(cashOnly.wealth_fund_category_id, 'tr-wealth');
  });

  it('clears the wealth mapping without touching the cash one', () => {
    const tr = mergeIntegrationSettings(stored, { wealth_fund_category_id: 'tr-wealth' });
    const cleared = mergeIntegrationSettings(tr, { wealth_fund_category_id: null });

    assert.equal(cleared.wealth_fund_category_id, null);
    assert.equal(cleared.fund_category_id, 'fund-cash');
  });

  it('preserves fields it does not know about', () => {
    // The provider writes other keys into this object — auth status, the bank
    // name, whatever a future version adds. A merge that dropped them would
    // disconnect the account.
    const withUnknown = { ...stored, something_new: 'kept' } as IntegrationSettings;
    const merged = mergeIntegrationSettings(withUnknown, { bulk_fetch_enabled: false });

    assert.equal((merged as Record<string, unknown>).something_new, 'kept');
  });
});
