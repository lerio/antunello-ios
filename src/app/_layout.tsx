import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { PrivacyProvider } from '@/features/privacy/privacy-provider';
import { persistOptions, queryClient } from '@/lib/query-client';
import { runRuntimeChecks } from '@/lib/runtime-check';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout.
 *
 * The tab bar lives one level down, in `(tabs)`, so that screens presented as
 * full-screen modals — the transaction form, the pending-transaction wizard —
 * can be siblings of it and therefore cover it. That is the native equivalent of
 * the web app hiding its bottom nav on the add/edit routes.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* Privacy sits outside auth: it is a display preference that survives
            sign-out rather than being tied to the session. */}
        <PrivacyProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Chooses between the signed-in and signed-out stacks.
 *
 * Kept separate from `RootLayout` so it can read the auth context, which only
 * exists inside `AuthProvider`.
 */
function RootNavigator() {
  const { session, isLoading } = useAuth();

  /**
   * The runtime guard, run **during** the first render rather than in an effect.
   *
   * It verifies that money formatting behaves — see `lib/runtime-check` — so it
   * has to complete before anything that formats money is allowed to paint. An
   * effect runs after the first commit, which is already too late: the tabs
   * would render, and on a warm start they render amounts straight from the
   * persisted cache. A lazy initializer runs before any child renders and still
   * keeps the failure inside React, where it can be shown instead of thrown at
   * module scope where nothing can catch it.
   */
  const [startupError] = useState<Error | null>(() => {
    try {
      runRuntimeChecks();
      return null;
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  });

  // The splash stays up until the stored session has been read, so a signed-in
  // user never sees the sign-in screen flash on a cold start.
  useEffect(() => {
    if (!isLoading || startupError) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, startupError]);

  if (startupError) return <StartupFailure error={startupError} />;
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* Presented as sheets rather than full-screen modals: a sheet is
            dismissable by swiping down, and a full-screen modal offers no way
            out at all. They are siblings of the tabs, so they cover the tab bar.
            Their header supplies the top inset. */}
        <Stack.Screen
          name="transaction/new"
          options={{ headerShown: true, presentation: 'modal', title: 'Add Transaction' }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ headerShown: true, presentation: 'modal', title: 'Transaction' }}
        />
        <Stack.Screen
          name="budget/new"
          options={{ headerShown: true, presentation: 'modal', title: 'New Budget' }}
        />
        <Stack.Screen
          name="budget/[id]"
          options={{ headerShown: true, presentation: 'modal', title: 'Budget' }}
        />
        <Stack.Screen
          name="pending"
          options={{ headerShown: true, presentation: 'modal', title: 'Review' }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Shown when a startup guard fails.
 *
 * A capability mismatch would corrupt money silently, so it has to be loud — but
 * a stack trace is unreadable on a phone. The guards' messages explain what
 * broke and how to fix it, so they are the whole screen.
 */
function StartupFailure({ error }: { error: Error }) {
  return (
    <ScrollView contentContainerStyle={styles.failure}>
      <Text style={styles.failureTitle}>Antunello can’t start</Text>
      <Text style={styles.failureBody}>{error.message}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  failure: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  failureTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  failureBody: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'ui-monospace',
  },
});
