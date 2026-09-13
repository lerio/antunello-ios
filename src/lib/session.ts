/**
 * The signed-in user's id, for code that writes rows.
 *
 * Read from the local session rather than `auth.getUser()`. The id is already
 * the one inside the access token — which is what row-level security compares
 * against — so a server round trip would confirm nothing extra.
 *
 * `transactions` and `budgets` both need it on insert: neither has a database
 * default for `user_id`, so a row without it fails with `42501 new row violates
 * row-level security policy` rather than a helpful "column is required".
 *
 * @throws If there is no session.
 */
import { supabase } from '@/lib/supabase';

export async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user.id) {
    throw new Error('You are not signed in.');
  }

  return session.user.id;
}
