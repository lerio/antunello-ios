import { PendingReview } from '@/features/pending/pending-review';

/**
 * Review bank imports.
 *
 * A modal sibling of the tabs rather than a screen inside one, so it covers the
 * tab bar — the review is a task the user finishes, not a place they browse, and
 * leaving the tab bar visible would invite tapping away mid-queue.
 */
export default function PendingScreen() {
  return <PendingReview />;
}
