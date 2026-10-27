import { Redirect } from 'expo-router';

/**
 * Filtering now lives on the search screen; keep old links working by opening
 * it with the filter sheet already up.
 */
export default function FilterScreen() {
  return <Redirect href="/transactions/search?filters=1" />;
}
