import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { usePendingTransactions } from '@/features/pending/use-pending-transactions';

/**
 * The four top-level destinations, mirroring the web app's navigation exactly.
 *
 * Icons are SF Symbols in both outline and filled weights, so the tab bar picks
 * up iOS 26's Liquid Glass treatment automatically and needs no image assets.
 *
 * Bank transactions waiting to be reviewed get a **badge on the Transactions
 * tab** rather than the web app's floating bell. A badge is where iOS puts a
 * count, it is visible from every tab rather than only the one it floats over,
 * and it does not sit on top of the list — which on a phone means on top of a
 * transaction.
 */
export default function TabsLayout() {
  const { pending } = usePendingTransactions();
  const count = pending.length;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
        />
        <NativeTabs.Trigger.Badge hidden={count === 0}>
          {count > 0 ? String(count) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
