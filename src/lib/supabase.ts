/**
 * The Supabase client, and the only place one is constructed.
 *
 * The app talks to the same Supabase project as the web app. Row-level security
 * scopes every query to `auth.uid() = user_id`, so the publishable key that
 * ships in the bundle grants nothing on its own.
 *
 * The web app authenticates with cookies via `@supabase/ssr`. A native app has
 * no cookies, so the session lives in `expo-sqlite` through Supabase's own
 * storage adapter and survives cold starts.
 */

// Must be imported before the client is created: this installs a `localStorage`
// global backed by SQLite, which Supabase uses to persist the session.
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase configuration is missing. Copy .env.example to .env.local and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (the same values ' +
      'the web app uses, from antunello-app/.env.local).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no OAuth redirect back into the app — sign-in is email and
    // password only, matching the web app.
    detectSessionInUrl: false,
  },
});

/**
 * Keeps the token refresh loop in step with the app lifecycle.
 *
 * Without this, the refresh timer keeps running while the app is backgrounded
 * and iOS eventually kills it; and on return to the foreground the first query
 * would go out with an expired token and 401.
 */
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
