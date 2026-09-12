import { Stack } from 'expo-router';

/**
 * The transactions stack.
 *
 * A stack rather than sibling tab routes so the month and year views share a
 * history: the Month/Year switch pushes and pops, and the tab bar stays visible
 * throughout — the year view is a peer of the month view, not a modal.
 */
export default function TransactionsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
