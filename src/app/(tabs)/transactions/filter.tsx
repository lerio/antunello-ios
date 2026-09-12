import { FilterView } from '@/features/filter/filter-view';

/**
 * Advanced filtering.
 *
 * A pushed screen beside search, and its own destination rather than a mode of
 * the month list: the criteria are assembled in the moment and discarded on the
 * way out, which is the opposite of how the month view treats its period.
 */
export default function FilterScreen() {
  return <FilterView />;
}
