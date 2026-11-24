import { Stack } from 'expo-router';

/**
 * The Home stack.
 *
 * A stack rather than sibling tab routes so the funds list pushed from the Net
 * worth card keeps the Home tab selected and the tab bar visible. Funds draws its
 * own `ScreenHeader` (title plus back chevron) to match the other screens; hiding
 * the native bar keeps the push animation and the swipe-back gesture.
 */
export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="funds" options={{ headerShown: false }} />
    </Stack>
  );
}
