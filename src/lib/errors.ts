/**
 * Turning thrown values into something readable.
 *
 * Supabase rejects with a plain object (`{ message, code, details, hint }`)
 * rather than an `Error`, so `String(error)` renders "[object Object]" and
 * discards the only information that explains the failure — including the
 * Postgres error code, which is often the single most useful part.
 */

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/**
 * Extracts a message from any thrown value.
 *
 * @param error Whatever was caught.
 * @returns A message including the error code when one is present.
 */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const details = error as SupabaseLikeError;

    const parts = [
      details.message,
      // The code distinguishes the cases a message alone cannot — a policy
      // violation (42501) reads very differently once you know it is not a
      // missing column.
      details.code ? `(${details.code})` : undefined,
      details.details,
      details.hint,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' · ');
  }

  return String(error);
}
