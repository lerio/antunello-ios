import { Stack } from 'expo-router';

/**
 * The Home stack.
 *
 * A stack rather than sibling tab routes so the funds list pushed from the Net
 * worth card keeps the Home tab selected, and the tab bar visible, with a native
 * back button.
 */
export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="funds" options={{ title: 'Funds', headerBackTitle: 'Home' }} />
    </Stack>
  );
}
