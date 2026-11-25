import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { categoryIconName } from '@/components/category-icon';
import { CategoryForm } from '@/features/categories/category-form';
import { useCategories } from '@/features/categories/use-categories';
import {
  canDeleteCategory,
  categoryTransactionCount,
  subcategoryTransactionCount,
} from '@/features/settings/category-sections';
import { useCategoryCounts } from '@/features/settings/use-category-counts';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';

/**
 * Renaming and deleting categories means migrating the transactions that use
 * them, which is not designed yet — on web either. Saving and deleting here are
 * placeholders until it is, and the sheet stays open so nothing looks saved.
 */
function notAvailable() {
  Alert.alert('Not available yet', "Editing categories isn't available yet.");
}

/**
 * Show or edit a category or subcategory: its type, title, how many transactions
 * use it and — for a main category — its icon. Opened with `category` and `type`
 * (a name can exist under both types) and, for a subcategory, `sub`.
 */
export function EditCategorySheet() {
  const router = useRouter();
  const { category, type, sub } = useLocalSearchParams<{
    category: string;
    type: string;
    sub?: string;
  }>();
  const { categories } = useCategories();
  const { data: counts } = useCategoryCounts();

  const entry = categories.find((cat) => cat.category === category && cat.type === type);
  const count = !entry
    ? undefined
    : sub
      ? subcategoryTransactionCount(counts, categories, entry, sub)
      : categoryTransactionCount(counts, categories, entry);

  return (
    <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
      {(dismiss) =>
        entry ? (
          <CategoryForm
            // The same sheet can be reused for another category without remounting.
            key={`${entry.type}/${entry.category}/${sub ?? ''}`}
            parentTitle={sub ? entry.category : undefined}
            type={entry.type}
            initialTitle={sub ?? entry.category}
            initialIcon={sub ? undefined : categoryIconName(entry.category)}
            isMovement={!sub && entry.category === 'Money Transfer'}
            transactionCount={count}
            canDelete={canDeleteCategory(entry, sub ?? null, count)}
            onDelete={notAvailable}
            onSubmit={async () => notAvailable()}
            onClose={dismiss}
          />
        ) : null
      }
    </TransactionSheet>
  );
}
