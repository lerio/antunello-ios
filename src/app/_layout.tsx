import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';

import { runRuntimeChecks } from '@/lib/runtime-check';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout.
 *
 * The tab bar lives one level down, in `(tabs)`, so that screens presented as
 * full-screen modals — the transaction form, the pending-transaction wizard —
 * are siblings of it and therefore cover it. That is the native equivalent of
 * the web app hiding its bottom nav on the add/edit routes.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Guards capabilities that vary by JS engine; see lib/runtime-check.
      runRuntimeChecks();
      setReady(true);
    } catch (error) {
      setStartupError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      SplashScreen.hideAsync();
    }
  }, []);

  if (startupError) return <StartupFailure error={startupError} />;
  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

/**
 * Shown when a startup guard fails.
 *
 * A capability mismatch would corrupt money silently, so it has to be loud —
 * but a bare stack trace on a phone is unreadable. The guards' messages explain
 * what broke and how to fix it, so they are the whole screen.
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
