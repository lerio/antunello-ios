import type { FundWithBalance } from '@/features/funds/use-fund-balances';

export type FundGroup = {
  name: string;
  funds: FundWithBalance[];
  totalEUR: number;
};

/**
 * Group funds by top-level category for the funds screen.
 *
 * Inactive funds are left out, matching the web app: the screen shows what is
 * currently held, not an archive. Groups and the funds inside them are ordered
 * by EUR value, so the largest holding reads first.
 */
export function groupFunds(funds: FundWithBalance[]): {
  groups: FundGroup[];
  totalEUR: number;
} {
  const byCategory = new Map<string, FundWithBalance[]>();

  for (const fund of funds) {
    if (!fund.is_active) continue;
    const category = fund.top_level_category || 'Uncategorized';
    byCategory.set(category, [...(byCategory.get(category) ?? []), fund]);
  }

  const groups = [...byCategory.entries()]
    .map(([name, categoryFunds]) => ({
      name,
      funds: categoryFunds.sort((a, b) => b.currentEurAmount - a.currentEurAmount),
      totalEUR: categoryFunds.reduce((sum, fund) => sum + fund.currentEurAmount, 0),
    }))
    .sort((a, b) => b.totalEUR - a.totalEUR);

  return {
    groups,
    totalEUR: groups.reduce((sum, group) => sum + group.totalEUR, 0),
  };
}
