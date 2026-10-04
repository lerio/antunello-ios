/**
 * The user's choice of light, dark or following the system.
 *
 * The web app's theme toggle is next-themes with `defaultTheme="system"`. This
 * is the same three-way choice. Kept free of React Native so it can be tested;
 * the storage and the native call are in `appearance.ts`.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Reads a stored value, falling back to "system" for anything unrecognised so a
 * corrupt or future value can never leave the app without a theme.
 */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * The scheme to force, or `'unspecified'` to hand control back to the system.
 *
 * `Appearance.setColorScheme('unspecified')` is how React Native 0.86 expresses
 * "follow the device" (earlier versions took null), so "system" maps to that
 * rather than to a scheme.
 */
export function colorSchemeFor(preference: ThemePreference): 'light' | 'dark' | 'unspecified' {
  return preference === 'system' ? 'unspecified' : preference;
}
