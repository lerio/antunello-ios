/**
 * Which banks are connected, and whether their session still works.
 *
 * There is no `bank_name` column. A connection is an `integration_configs` row
 * whose `settings` JSON names the bank, and the matching is fuzzy — the sync
 * service writes what the provider called the bank, which is not always what the
 * settings screen calls it. Two special cases exist on top of that, both in the
 * web app and both reproduced here:
 *
 *  - **Bunq** connections created before the name was recorded have no
 *    `bank_name` at all, and are identifiable only by their provider.
 *  - **Trade Republic** connections are identified by provider alone, because its
 *    provider string is distinct rather than its name.
 *
 * This is the sort of matching that is easy to get subtly wrong and impossible
 * to notice when it is: a connection the user can see working, reported as not
 * connected. Hence a pure module and a test.
 */

/** A row of `integration_configs`. */
export type IntegrationConfig = {
  id: string;
  user_id: string;
  provider: 'enable_banking' | 'trade_republic';
  /** The provider's own account id. */
  account_id: string;
  last_sync_at: string | null;
  settings: IntegrationSettings | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationSettings = {
  bank_name?: string;
  /** `session_expired` when the bank needs re-authenticating. */
  auth_status?: string;
  iban?: string;
};

export type BankDefinition = {
  name: string;
  /** ISO country code the bank is connected through. */
  country: string;
  description: string;
};

/**
 * The banks the app can connect, in the order the settings page lists them.
 *
 * Kept in step with the web app's array by hand. The list is a *display* list
 * only — connecting happens in the browser, and nothing here constrains what a
 * connection may be.
 */
export const SUPPORTED_BANKS: readonly BankDefinition[] = [
  { name: 'Bunq', country: 'NL', description: 'Connect your Bunq (NL) accounts.' },
  { name: 'Revolut', country: 'IT', description: 'Connect your Revolut (IT) accounts.' },
  { name: 'DKB', country: 'DE', description: 'Connect your DKB (DE) accounts.' },
  { name: 'PayPal', country: 'IT', description: 'Connect your PayPal (IT) account.' },
  { name: 'Wise', country: 'IT', description: 'Connect your Wise (IT) accounts.' },
  {
    name: 'Trade Republic',
    country: 'DE',
    description: 'Connect your Trade Republic investment account.',
  },
];

/** Case- and whitespace-insensitive form of a bank name, for comparison. */
export function normalizeBankName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Whether a stored name refers to a bank.
 *
 * Substring rather than equality, matching the web app: the provider reports
 * "Revolut Bank" where the settings screen says "Revolut".
 *
 * @param storedBankName The name from the connection's settings.
 * @param bankName The name the settings screen uses.
 * @returns True if they refer to the same bank.
 */
export function bankNamesMatch(storedBankName: unknown, bankName: string): boolean {
  const stored = normalizeBankName(storedBankName);
  const expected = normalizeBankName(bankName);

  return stored === expected || stored.includes(expected);
}

/**
 * Whether a connection is the one for a given bank.
 *
 * The name check runs first and applies to **every** bank, Trade Republic
 * included — so the provider rules below are additional ways to match, not
 * exclusive ones. That ordering is the web app's and is what makes a Trade
 * Republic connection visible: its settings carry no bank name, so without the
 * provider rule it would match nothing and the bank would read as disconnected
 * while syncing perfectly well.
 *
 * @param account A connection row.
 * @param bankName The bank being asked about.
 * @returns True if this row represents that bank.
 */
function accountIsForBank(account: IntegrationConfig, bankName: string): boolean {
  const settings = account.settings ?? {};

  if (bankNamesMatch(settings.bank_name, bankName)) return true;

  // Connections made before the bank's name was recorded have only their
  // provider to go on.
  if (bankName === 'Bunq' && !settings.bank_name && account.provider === 'enable_banking') {
    return true;
  }

  return bankName === 'Trade Republic' && account.provider === 'trade_republic';
}

/**
 * Every connection belonging to a bank.
 *
 * A bank can have more than one: Revolut IT and Revolut NL are two accounts
 * behind one name.
 *
 * @param accounts All of the user's connections.
 * @param bankName The bank to filter to.
 * @returns The matching rows.
 */
export function connectionsFor(
  accounts: readonly IntegrationConfig[],
  bankName: string,
): IntegrationConfig[] {
  return accounts.filter((account) => accountIsForBank(account, bankName));
}

/**
 * Whether a bank is connected.
 *
 * @param accounts All of the user's connections.
 * @param bankName The bank being asked about.
 * @returns True if at least one connection represents it.
 */
export function isBankConnected(
  accounts: readonly IntegrationConfig[],
  bankName: string,
): boolean {
  return connectionsFor(accounts, bankName).length > 0;
}

/**
 * Whether a connected bank needs re-authenticating.
 *
 * Scoped to the bank's own connections rather than to the whole list, so one
 * bank's expired session does not mark every other bank as expired too.
 *
 * @param accounts All of the user's connections.
 * @param bankName The bank being asked about.
 * @returns True if any of its connections reports an expired session.
 */
export function hasExpiredSession(
  accounts: readonly IntegrationConfig[],
  bankName: string,
): boolean {
  return connectionsFor(accounts, bankName).some(
    (account) => (account.settings ?? {}).auth_status === 'session_expired',
  );
}

/**
 * When the most recent sync of a bank's connections completed.
 *
 * @param accounts All of the user's connections.
 * @param bankName The bank being asked about.
 * @returns An ISO timestamp, or null if it has never synced.
 */
export function lastSyncFor(
  accounts: readonly IntegrationConfig[],
  bankName: string,
): string | null {
  const timestamps = connectionsFor(accounts, bankName)
    .map((account) => account.last_sync_at)
    .filter((value): value is string => typeof value === 'string');

  if (timestamps.length === 0) return null;

  return timestamps.reduce((latest, value) => (value > latest ? value : latest));
}
