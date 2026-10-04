/**
 * Storing the theme preference and applying it.
 *
 * `Appearance.setColorScheme` overrides the scheme for the whole app, native
 * chrome included — the tab bar, alerts and pickers — so nothing else needs to
 * know about the preference. `useColorScheme` reports the override, which is
 * what `useTheme` and the navigation theme already read.
 */

import Storage from 'expo-sqlite/kv-store';
import { Appearance } from 'react-native';

import {
  colorSchemeFor,
  parseThemePreference,
  type ThemePreference,
} from '@/features/appearance/theme-preference';

const STORAGE_KEY = 'antunello.theme-preference';

/** Reads synchronously, so the first frame is already the right theme. */
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(Storage.getItemSync(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  Appearance.setColorScheme(colorSchemeFor(preference));
}

export function saveThemePreference(preference: ThemePreference): void {
  applyThemePreference(preference);
  try {
    Storage.setItemSync(STORAGE_KEY, preference);
  } catch {
    // A convenience: failing to persist it must not undo the change in effect.
  }
}
