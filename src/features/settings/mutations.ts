/**
 * Writing to a bank connection, and triggering a sync.
 *
 * Two very different mechanisms, for a reason worth stating plainly:
 *
 *  - **Settings are written directly.** `integration_configs` has an owner-update
 *    policy, so a fund mapping or a toggle is an ordinary RLS-scoped update. The
 *    web app routes this through an API handler only because that is where its
 *    settings page happens to live.
 *
 *  - **A sync cannot be.** It talks to Enable Banking, signing a JWT with a
 *    private key that is server-side only and must never reach a device. There
 *    is no way to do it from here, and there should not be. So the app asks the
 *    web app to do it, presenting the user's own access token — which the sync
 *    route accepts and verifies against the auth server.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  mergeIntegrationSettings,
  type IntegrationSettingsPatch,
} from '@/features/settings/integration-settings';
import type { IntegrationConfig } from '@/features/settings/integration-status';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** The deployed web app, which is what runs a sync. */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/**
 * One account's sync outcome from the web app.
 *
 * `error` is a field rather than a thrown failure because the route reports
 * per-account results: one account can fail while another succeeds, and both
 * arrive in a 200.
 */
type SyncResult = {
  account_id?: string;
  new_pending?: number;
  error?: string | null;
};

type SyncResponse = {
  results?: SyncResult[];
  error?: string;
};

export type SyncOutcome = {
  /** How many pending transactions the sync added. */
  newPending: number;
  /** The route's message when the account failed, if it did. */
  error: string | null;
};

/**
 * Asks the web app to sync one account.
 *
 * The access token is refreshed first when it is close to expiring. A token that
 * has already lapsed produces a 401 that reads like a permissions problem rather
 * than a clock one, and the refresh costs nothing when the token is still good.
 *
 * @param accountId The provider's account id, not the row id.
 * @returns What the sync found.
 * @throws When the token is missing, the request fails, or the route refuses it.
 */
export async function requestSync(accountId: string): Promise<SyncOutcome> {
  if (!WEB_URL) {
    throw new Error('The web app URL is not configured, so a sync cannot be started.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  let token = session?.access_token;
  if (!token) throw new Error('You are not signed in.');

  // Refresh when within a minute of expiry, so a sync started at the wrong
  // moment does not fail with what looks like an authorization error.
  const expiresAt = (session?.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() < 60_000) {
    const { data } = await supabase.auth.refreshSession();
    token = data.session?.access_token ?? token;
  }

  const response = await fetch(`${WEB_URL}/api/cron/sync?account_id=${encodeURIComponent(accountId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = (await response.json().catch(() => ({}))) as SyncResponse;

  if (!response.ok) {
    throw new Error(
      body.error ??
        (response.status === 401
          ? 'The web app did not accept your session. Sign in again and retry.'
          : `The sync failed (${response.status}).`),
    );
  }

  const result = body.results?.[0];

  // A daily API limit is the one failure worth naming: the bank's own quota,
  // which waiting fixes and retrying does not.
  const error = result?.error ?? null;
  if (error && (error.includes('429') || error.includes('RATE_LIMIT'))) {
    return { newPending: 0, error: 'The bank’s daily API limit was reached. Try again tomorrow.' };
  }

  return { newPending: result?.new_pending ?? 0, error };
}

/**
 * Changes an account's settings.
 *
 * @returns A mutation; call `.mutateAsync({ config, patch })` to run it.
 */
export function useUpdateIntegrationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      config,
      patch,
    }: {
      config: IntegrationConfig;
      patch: IntegrationSettingsPatch;
    }): Promise<void> => {
      const settings = mergeIntegrationSettings(config.settings, patch);

      const { error } = await supabase
        .from('integration_configs')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', config.id);

      if (error) throw error;
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.integrations() });
    },
  });
}
