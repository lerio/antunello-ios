/**
 * The user's bank connections.
 *
 * Read-only. Connecting, re-authenticating and disconnecting all live on the web
 * app's settings page, which opens in an in-app browser: the Enable Banking flow
 * needs a private key that must never ship in an app, and Trade Republic's needs
 * a phone, a PIN and an app confirmation. Reimplementing either here would mean
 * putting secrets on the device to replace a flow that already works.
 */

import { useQuery } from '@tanstack/react-query';

import type { IntegrationConfig } from '@/features/settings/integration-status';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/**
 * Loads the connection rows backing the Settings screen.
 *
 * @returns A query resolving to the connections, or an empty list.
 */
export function useIntegrations() {
  return useQuery({
    queryKey: qk.integrations(),
    queryFn: async (): Promise<IntegrationConfig[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user.id) return [];

      const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;
      return (data ?? []) as IntegrationConfig[];
    },
  });
}
