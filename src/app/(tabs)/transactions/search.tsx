import { SearchView } from '@/features/search/search-view';

/**
 * Search.
 *
 * A pushed screen inside the transactions stack rather than a tab of its own:
 * search is something you do *to* the transaction list, and pushing it keeps the
 * month the user came from one back-gesture away.
 */
export default function SearchScreen() {
  return <SearchView />;
}
