/**
 * Validating a password change.
 *
 * Ported from the web app's `resetPasswordAction`, which checks that both fields
 * are present and that they match, and leaves every other rule (length,
 * strength) to Supabase — whose own message is then shown.
 */

/**
 * @returns A message describing what is wrong, or null when the pair is fine.
 */
export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) return 'Password and confirm password are required';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
}
