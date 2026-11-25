import { useLocalSearchParams, useRouter } from 'expo-router';

import { FundForm } from '@/features/settings/fund-form';
import { useAllFunds, useFundCategoryMutations } from '@/features/settings/use-fund-categories';
import { TransactionSheet } from '@/features/transactions/form/transaction-sheet';
import { hapticSuccess } from '@/lib/haptics';

/**
 * Add a fund, or — given an `id` — edit or delete one, in the shared bottom sheet.
 *
 * The fund is read from the list Settings already loaded, so the sheet opens
 * without a fetch of its own.
 */
export function FundSheet() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: funds } = useAllFunds();
  const { addFund, updateFund, deleteFund } = useFundCategoryMutations();

  const fund = id ? funds?.find((candidate) => candidate.id === id) : undefined;

  return (
    <TransactionSheet avoidKeyboard onDismiss={() => router.back()}>
      {(dismiss) =>
        id && !fund ? null : (
          <FundForm
            fund={fund}
            onClose={dismiss}
            onSubmit={async (draft) => {
              if (fund) await updateFund.mutateAsync({ id: fund.id, draft });
              else await addFund.mutateAsync({ draft, orderIndex: funds?.length ?? 0 });
              hapticSuccess();
              dismiss();
            }}
            onDelete={
              fund
                ? async () => {
                    await deleteFund.mutateAsync(fund.id);
                    dismiss();
                  }
                : undefined
            }
          />
        )
      }
    </TransactionSheet>
  );
}
