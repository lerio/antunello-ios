/**
 * Fund accounts with their current balances, for the Balance card.
 *
 * Ported from the web app's `useFundCategories`. The shape of the calculation
 * matters and is reproduced exactly:
 *
 *   current amount = the fund's manual opening balance
 *                  + the sum of its transactions, computed in SQL
 *
 * The delta comes from the `get_fund_balances` RPC rather than being totalled
 * here, so the two apps cannot disagree about it. Only the currency conversion
 * happens client-side, matching the web app — each non-EUR fund is converted at
 * today's rate, because a fund's balance is a present-tense figure rather than a
 * historical one.
 *
 * Distinct from `useFunds`, which is the cheap list the pickers need: this one
 * costs an RPC plus a network call per non-EUR fund, and is invalidated by every
 * transaction write.
 */

import { useQuery } from '@tanstack/react-query';

import type { FundCategory } from '@/domain/types';
import { convertToEUR } from '@/features/transactions/exchange-rates';
import { qk } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** A fund with its balance, in both its own currency and EUR. */
export type FundWithBalance = FundCategory & {
  /** Opening balance plus all its transactions, in the fund's own currency. */
  currentAmount: number;
  /** The same figure in EUR. Equal to `currentAmount` for a EUR fund. */
  currentEurAmount: number;
};

export type FundBalances = {
  funds: FundWithBalance[];
  /** Every fund's balance converted to EUR and summed. */
  totalEUR: number;
};

/** One row of the `get_fund_balances` result. */
type FundBalanceRow = {
  fund_id: string;
  balance: number;
};

/**
 * Today's date as `YYYY-MM-DD`.
 *
 * Fund balances are converted at today's rate rather than a historical one —
 * unlike a transaction, a balance is a statement about the present.
 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches every fund with its balance.
 *
 * Includes inactive funds, matching the web app: deactivating a fund hides it
 * from the pickers, but its money still exists and leaving it out of the total
 * would understate the balance.
 */
export function useFundBalances() {
  return useQuery({
    queryKey: qk.fundBalances(),
    queryFn: async (): Promise<FundBalances> => {
      const { data: fundCategories, error: fundsError } = await supabase
        .from('fund_categories')
        .select('*')
        .order('order_index', { ascending: true });

      if (fundsError) throw fundsError;

      const funds = (fundCategories ?? []) as FundCategory[];

      // Read the id from the local session rather than calling getUser(), which
      // would add an auth round-trip to every balance refresh.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user.id;

      const deltaByFundId = new Map<string, number>();
      if (userId) {
        const { data: rows, error: rpcError } = await supabase.rpc('get_fund_balances', {
          p_user_id: userId,
        });

        if (rpcError) throw rpcError;

        for (const row of (rows ?? []) as FundBalanceRow[]) {
          deltaByFundId.set(row.fund_id, Number(row.balance) || 0);
        }
      }

      const withAmounts = funds.map((fund) => ({
        fund,
        currentAmount: Number(fund.amount) + (deltaByFundId.get(fund.id) ?? 0),
      }));

      // One conversion per non-EUR fund, in parallel.
      const rateDate = today();
      const nonEur = withAmounts.filter(({ fund }) => fund.currency !== 'EUR');

      const conversions = await Promise.all(
        nonEur.map(({ fund, currentAmount }) =>
          convertToEUR(currentAmount, fund.currency, rateDate),
        ),
      );

      const eurByFundId = new Map<string, number>();
      nonEur.forEach(({ fund }, index) => {
        eurByFundId.set(fund.id, conversions[index]?.eurAmount ?? 0);
      });

      const result: FundWithBalance[] = withAmounts.map(({ fund, currentAmount }) => ({
        ...fund,
        currentAmount,
        // A EUR fund needs no conversion, so it is its own EUR amount.
        currentEurAmount:
          fund.currency === 'EUR' ? currentAmount : (eurByFundId.get(fund.id) ?? 0),
      }));

      return {
        funds: result,
        totalEUR: result.reduce((sum, fund) => sum + fund.currentEurAmount, 0),
      };
    },
  });
}
