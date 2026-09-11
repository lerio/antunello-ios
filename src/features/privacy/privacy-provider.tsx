import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'antunello.privacy-mode';

type PrivacyState = {
  /** Whether financial values should be hidden. */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
};

const PrivacyContext = createContext<PrivacyState | null>(null);

/** Reads the persisted preference, tolerating a cold or unavailable database. */
function readStoredPreference(): boolean {
  try {
    return Storage.getItemSync(STORAGE_KEY) === 'true';
  } catch {
    // First launch, or the database is not ready — failing closed to "off"
    // matches the default the user sees, and the value is written on first
    // toggle anyway.
    return false;
  }
}

/**
 * Holds the privacy-mode preference.
 *
 * The initial read is **synchronous**, which is why this uses `expo-sqlite`'s
 * `getItemSync` rather than the async adapter the Supabase session uses. Privacy
 * mode hides financial values, so a state that resolved after the first render
 * would paint the amounts on screen and then cover them — the one case where a
 * visible flash is a real problem rather than a cosmetic one.
 *
 * (The web app avoids the same problem with a `mounted` flag, because
 * localStorage is synchronous but React hydration is not. Native has no
 * hydration step, so a synchronous read is enough.)
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(readStoredPreference);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      Storage.setItemSync(STORAGE_KEY, String(next));
    } catch {
      // The preference is a convenience; failing to persist it should not
      // break the session. The in-memory state is already updated.
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((current) => {
      const next = !current;
      try {
        Storage.setItemSync(STORAGE_KEY, String(next));
      } catch {
        // as above
      }
      return next;
    });
  }, []);

  const value = useMemo<PrivacyState>(
    () => ({ enabled, setEnabled, toggle }),
    [enabled, setEnabled, toggle],
  );

  return <PrivacyContext value={value}>{children}</PrivacyContext>;
}

/**
 * Reads the privacy context.
 *
 * @throws {Error} If called outside a `PrivacyProvider`.
 */
export function usePrivacy(): PrivacyState {
  const context = use(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used inside a PrivacyProvider');
  }
  return context;
}
