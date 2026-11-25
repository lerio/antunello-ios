import { useLocalSearchParams, useRouter } from 'expo-router';

import { CategoryForm } from '@/features/categories/category-form';
import type { CategoryType } from '@/features/categories/registry';
import { useCategories } from '@/features/categories/use-categories';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';
import { hapticSuccess } from '@/lib/haptics';

/**
 * Add a main category, or — given a `parent` and its `type` — a subcategory of it.
 *
 * Names are unique per type: the same name is fine under a different type, but
 * not twice under one. A subcategory must be new within its own parent.
 */
export function NewCategorySheet() {
  const router = useRouter();
  const { parent, type } = useLocalSearchParams<{ parent?: string; type?: string }>();
  const { categories, addCategory } = useCategories();

  const parentType: CategoryType | undefined =
    type === 'income' || type === 'expense' ? type : undefined;

  const submit = (dismiss: () => void) =>
    async ({ title, type: chosen, icon }: { title: string; type: CategoryType; icon: string }) => {
      const same = (name: string) => name.toLowerCase() === title.toLowerCase();

      if (parent && parentType) {
        const entry = categories.find((cat) => cat.category === parent && cat.type === parentType);
        if (entry?.subcategories.some(same)) {
          throw new Error(`"${parent}" already has a subcategory called "${title}".`);
        }
        await addCategory.mutateAsync({ name: title, type: parentType, parentCategory: parent });
      } else {
        if (categories.some((cat) => cat.type === chosen && same(cat.category))) {
          throw new Error(`A ${chosen} category called "${title}" already exists.`);
        }
        await addCategory.mutateAsync({ name: title, type: chosen, icon });
      }

      hapticSuccess();
      dismiss();
    };

  return (
    <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
      {(dismiss) => (
        <CategoryForm
          parentTitle={parent}
          type={parentType}
          onSubmit={submit(dismiss)}
          onClose={dismiss}
        />
      )}
    </TransactionSheet>
  );
}
