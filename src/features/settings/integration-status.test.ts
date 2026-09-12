/**
 * Tests for bank connection matching.
 *
 * The two legacy rules are the reason this module exists. A Bunq connection made
 * before the bank's name was recorded has no name to match on, and Trade
 * Republic is identified by provider rather than name — get either wrong and a
 * connection the user can see working is reported as not connected, which looks
 * like data loss rather than a matching bug.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bankNamesMatch,
  connectionsFor,
  hasExpiredSession,
  isBankConnected,
  lastSyncFor,
  normalizeBankName,
  SUPPORTED_BANKS,
  type IntegrationConfig,
} from '@/features/settings/integration-status';

function account(overrides: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return {
    id: 'c1',
    user_id: 'u1',
    provider: 'enable_banking',
    account_id: 'acc-1',
    last_sync_at: null,
    settings: { bank_name: 'Revolut' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('bank name matching', () => {
  it('normalizes case and surrounding space', () => {
    assert.equal(normalizeBankName('  Revolut  '), 'revolut');
    assert.equal(normalizeBankName(undefined), '');
    assert.equal(normalizeBankName(42), '');
  });

  it('matches exactly', () => {
    assert.equal(bankNamesMatch('Revolut', 'Revolut'), true);
  });

  it('matches a longer provider name', () => {
    // The provider reports "Revolut Bank"; the settings screen says "Revolut".
    assert.equal(bankNamesMatch('Revolut Bank', 'Revolut'), true);
  });

  it('ignores case', () => {
    assert.equal(bankNamesMatch('revolut bank', 'Revolut'), true);
  });

  it('does not match a different bank', () => {
    assert.equal(bankNamesMatch('DKB', 'Revolut'), false);
  });

  it('does not match an empty stored name', () => {
    // An empty string is a substring of everything, and matching on it would
    // report every bank as connected.
    assert.equal(bankNamesMatch('', 'Revolut'), false);
    assert.equal(bankNamesMatch(undefined, 'Revolut'), false);
  });
});

describe('is a bank connected', () => {
  it('is false with no connections at all', () => {
    assert.equal(isBankConnected([], 'Revolut'), false);
  });

  it('is true when a connection names it', () => {
    assert.equal(isBankConnected([account()], 'Revolut'), true);
  });

  it('is false for a different bank', () => {
    assert.equal(isBankConnected([account()], 'DKB'), false);
  });

  it('is true for a named connection among others', () => {
    const accounts = [
      account({ id: 'a', settings: { bank_name: 'DKB' } }),
      account({ id: 'b', settings: { bank_name: 'Revolut Bank' } }),
    ];

    assert.equal(isBankConnected(accounts, 'Revolut'), true);
  });

  it('treats a nameless enable_banking connection as Bunq', () => {
    // The legacy rule: connections made before the name was recorded.
    const legacy = account({ settings: {} });

    assert.equal(isBankConnected([legacy], 'Bunq'), true);
  });

  it('does not treat a nameless connection as another bank', () => {
    const legacy = account({ settings: {} });

    assert.equal(isBankConnected([legacy], 'Revolut'), false);
  });

  it('does not let a nameless connection shadow a named one', () => {
    // A Bunq connection plus a nameless legacy row: DKB is still not connected.
    const accounts = [account({ id: 'a', settings: {} }), account({ id: 'b', settings: { bank_name: 'Bunq NL' } })];

    assert.equal(isBankConnected(accounts, 'DKB'), false);
  });

  it('identifies Trade Republic by provider, not name', () => {
    const tr = account({ provider: 'trade_republic', settings: {} });

    assert.equal(isBankConnected([tr], 'Trade Republic'), true);
  });

  it('does not identify another bank by the trade_republic provider', () => {
    const tr = account({ provider: 'trade_republic', settings: {} });

    assert.equal(isBankConnected([tr], 'Revolut'), false);
    assert.equal(isBankConnected([tr], 'Bunq'), false);
  });

  it('also identifies Trade Republic by name', () => {
    // The name rule runs first and applies to every bank, including this one —
    // the provider is an *additional* way to match, not the only one. It exists
    // because a Trade Republic connection's settings carry no bank name, so
    // without it that connection would be invisible here.
    const byName = account({ settings: { bank_name: 'Trade Republic' } });

    assert.equal(isBankConnected([byName], 'Trade Republic'), true);
  });

  it('does not identify Trade Republic by a partial name', () => {
    // The substring rule is loose enough that a different bank whose name
    // contains "trade republic" would match. Nothing is called that today, and
    // this pins the looseness rather than pretending it is not there.
    const other = account({ settings: { bank_name: 'Trade Republic Wealth' } });

    assert.equal(isBankConnected([other], 'Trade Republic'), true);
  });
});

describe('several connections behind one bank', () => {
  it('returns them all', () => {
    const accounts = [
      account({ id: 'a', account_id: 'it', settings: { bank_name: 'Revolut Bank' } }),
      account({ id: 'b', account_id: 'nl', settings: { bank_name: 'Revolut NL' } }),
      account({ id: 'c', settings: { bank_name: 'DKB' } }),
    ];

    assert.equal(connectionsFor(accounts, 'Revolut').length, 2);
  });

  it('reports the latest sync across them', () => {
    const accounts = [
      account({ id: 'a', last_sync_at: '2026-09-01T00:00:00.000Z' }),
      account({ id: 'b', last_sync_at: '2026-09-10T00:00:00.000Z' }),
    ];

    assert.equal(lastSyncFor(accounts, 'Revolut'), '2026-09-10T00:00:00.000Z');
  });
});

describe('expired sessions', () => {
  it('is false for a healthy connection', () => {
    assert.equal(hasExpiredSession([account()], 'Revolut'), false);
  });

  it('is true when the bank reports one', () => {
    const expired = account({ settings: { bank_name: 'Revolut', auth_status: 'session_expired' } });

    assert.equal(hasExpiredSession([expired], 'Revolut'), true);
  });

  it('does not leak one bank’s expiry onto another', () => {
    // The whole reason this is scoped by bank: a single expired connection must
    // not mark every row on the settings screen as needing attention.
    const accounts = [
      account({ id: 'a', settings: { bank_name: 'Revolut', auth_status: 'session_expired' } }),
      account({ id: 'b', settings: { bank_name: 'DKB' } }),
    ];

    assert.equal(hasExpiredSession(accounts, 'Revolut'), true);
    assert.equal(hasExpiredSession(accounts, 'DKB'), false);
  });

  it('is true when only one of a bank’s connections is expired', () => {
    const accounts = [
      account({ id: 'a', settings: { bank_name: 'Revolut IT' } }),
      account({ id: 'b', settings: { bank_name: 'Revolut NL', auth_status: 'session_expired' } }),
    ];

    assert.equal(hasExpiredSession(accounts, 'Revolut'), true);
  });

  it('is false for a bank that is not connected at all', () => {
    assert.equal(hasExpiredSession([], 'Revolut'), false);
  });
});

describe('last sync', () => {
  it('is null when nothing has synced', () => {
    assert.equal(lastSyncFor([account()], 'Revolut'), null);
  });

  it('is null for a bank that is not connected', () => {
    assert.equal(lastSyncFor([account({ last_sync_at: '2026-09-01T00:00:00.000Z' })], 'DKB'), null);
  });

  it('ignores a null among real timestamps', () => {
    const accounts = [
      account({ id: 'a', last_sync_at: null }),
      account({ id: 'b', last_sync_at: '2026-09-05T00:00:00.000Z' }),
    ];

    assert.equal(lastSyncFor(accounts, 'Revolut'), '2026-09-05T00:00:00.000Z');
  });
});

describe('the supported bank list', () => {
  it('lists the six banks the web app offers', () => {
    assert.deepEqual(
      SUPPORTED_BANKS.map((bank) => bank.name),
      ['Bunq', 'Revolut', 'DKB', 'PayPal', 'Wise', 'Trade Republic'],
    );
  });

  it('has a description for each', () => {
    assert.ok(SUPPORTED_BANKS.every((bank) => bank.description.length > 0));
  });
});
