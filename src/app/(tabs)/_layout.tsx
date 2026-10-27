import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { usePendingTransactions } from '@/features/pending/use-pending-transactions';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four top-level destinations, mirroring the web app's navigation exactly.
 *
 * The tab icons are the web app's own Lucide glyphs, rasterised to template
 * images — NativeTabs draws SF Symbols or images, and an SF lookalike still
 * reads as a different icon set.
 *
 * Bank transactions waiting to be reviewed get a **badge on the Activity
 * tab** rather than the web app's floating bell. A badge is where iOS puts a
 * count, it is visible from every tab rather than only the one it floats over,
 * and it does not sit on top of the list — which on a phone means on top of a
 * transaction.
 */
export default function TabsLayout() {
  const { pending } = usePendingTransactions();
  const theme = useTheme();
  const count = pending.length;

  return (
    <NativeTabs tintColor={theme.tint}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/tab-icons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/tab-icons/banknote.png')}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Badge hidden={count === 0}>
          {count > 0 ? String(count) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/tab-icons/pie-chart.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/tab-icons/settings.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
